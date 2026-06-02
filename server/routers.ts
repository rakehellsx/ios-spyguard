import { z } from "zod";
import * as bcrypt from "bcryptjs";
import * as jose from "jose";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createLocalAccount,
  getLocalAccountByUsername,
  getLocalAccountById,
  updateLocalAccountLastSignedIn,
  countLocalAccounts,
  listDevices,
  getDeviceById,
  upsertDevice,
  updateDeviceStatus,
  deleteDevice,
  countDevices,
  listIocFiles,
  getIocFileById,
  createIocFile,
  updateIocFileActive,
  deleteIocFile,
  listScanTasks,
  getScanTaskById,
  createScanTask,
  updateScanTask,
  deleteScanTask,
  countScanTasks,
  listScanResults,
  insertScanResults,
  countTotalThreats,
  upsertUser,
  getUserByOpenId,
} from "./db";
import { runDetection, generateMarkdownReport } from "./detectionEngine";
import { storagePut } from "./storage";

const JWT_SECRET = process.env.JWT_SECRET ?? "spyguard-secret-key";
const LOCAL_COOKIE = "spyguard_local_token";

// ─── JWT helpers ──────────────────────────────────────────────────────────────
async function signLocalJwt(payload: { id: number; username: string; role: string }) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

async function verifyLocalJwt(token: string) {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as { id: number; username: string; role: string };
  } catch {
    return null;
  }
}

// ─── Get local user from request ─────────────────────────────────────────────
async function getLocalUserFromCtx(ctx: any) {
  const token = ctx.req?.cookies?.[LOCAL_COOKIE] ?? ctx.req?.headers?.["x-local-token"];
  if (!token) return null;
  const payload = await verifyLocalJwt(token);
  if (!payload) return null;
  return await getLocalAccountById(payload.id);
}

// ─── Mock device detection ────────────────────────────────────────────────────
const MOCK_DEVICES = [
  {
    udid: "00008110-001A2B3C4D5E6F78",
    name: "iPhone 15 Pro",
    model: "iPhone 15 Pro",
    productType: "iPhone16,1",
    iosVersion: "17.4.1",
    buildVersion: "21E236",
    serialNumber: "F2LXQ8XXXXXX",
    status: "connected" as const,
  },
  {
    udid: "00008101-001B2C3D4E5F6789",
    name: "iPhone 13",
    model: "iPhone 13",
    productType: "iPhone14,5",
    iosVersion: "16.7.2",
    buildVersion: "20H115",
    serialNumber: "G8RXXXX12345",
    status: "disconnected" as const,
  },
];

export const appRouter = router({
  system: systemRouter,

  // ─── Manus OAuth auth ───────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(async (opts) => {
      // Check local JWT first
      const localUser = await getLocalUserFromCtx(opts.ctx);
      if (localUser) {
        return {
          id: localUser.id,
          username: localUser.username,
          displayName: localUser.displayName ?? localUser.username,
          role: localUser.role,
          authType: "local" as const,
        };
      }
      // Fall back to Manus OAuth
      if (opts.ctx.user) {
        return {
          id: opts.ctx.user.id,
          username: opts.ctx.user.email ?? opts.ctx.user.openId,
          displayName: opts.ctx.user.name ?? opts.ctx.user.email ?? "用户",
          role: opts.ctx.user.role,
          authType: "oauth" as const,
        };
      }
      return null;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(LOCAL_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Local account auth ─────────────────────────────────────────────────────
  localAuth: router({
    register: publicProcedure
      .input(
        z.object({
          username: z.string().min(3).max(32),
          password: z.string().min(6).max(128),
          displayName: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await getLocalAccountByUsername(input.username);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "用户名已存在" });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const count = await countLocalAccounts();
        await createLocalAccount({
          username: input.username,
          passwordHash,
          displayName: input.displayName ?? input.username,
          role: count === 0 ? "admin" : "user", // First user is admin
        });
        const account = await getLocalAccountByUsername(input.username);
        if (!account) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const token = await signLocalJwt({ id: account.id, username: account.username, role: account.role });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(LOCAL_COOKIE, token, { ...cookieOptions, maxAge: 7 * 24 * 3600 });
        return {
          success: true,
          user: { id: account.id, username: account.username, displayName: account.displayName, role: account.role },
        };
      }),

    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const account = await getLocalAccountByUsername(input.username);
        if (!account) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名或密码错误" });
        }
        const valid = await bcrypt.compare(input.password, account.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名或密码错误" });
        }
        await updateLocalAccountLastSignedIn(account.id);
        const token = await signLocalJwt({ id: account.id, username: account.username, role: account.role });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(LOCAL_COOKIE, token, { ...cookieOptions, maxAge: 7 * 24 * 3600 });
        return {
          success: true,
          user: { id: account.id, username: account.username, displayName: account.displayName, role: account.role },
        };
      }),

    checkHasAccounts: publicProcedure.query(async () => {
      const count = await countLocalAccounts();
      return { hasAccounts: count > 0 };
    }),
  }),

  // ─── Dashboard stats ────────────────────────────────────────────────────────
  dashboard: router({
    stats: publicProcedure.query(async () => {
      const [devices, tasks, threats] = await Promise.all([
        countDevices(),
        countScanTasks(),
        countTotalThreats(),
      ]);
      return { devices, tasks, threats };
    }),
  }),

  // ─── Devices ────────────────────────────────────────────────────────────────
  devices: router({
    list: publicProcedure.query(async () => {
      return await listDevices();
    }),

    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const device = await getDeviceById(input.id);
      if (!device) throw new TRPCError({ code: "NOT_FOUND" });
      return device;
    }),

    scan: publicProcedure.mutation(async () => {
      // Simulate device discovery via libimobiledevice
      const results = [];
      for (const mock of MOCK_DEVICES) {
        const device = await upsertDevice({ ...mock, lastSeen: new Date() });
        results.push(device);
      }
      return { found: results.length, devices: results };
    }),

    add: publicProcedure
      .input(
        z.object({
          udid: z.string(),
          name: z.string().optional(),
          model: z.string().optional(),
          productType: z.string().optional(),
          iosVersion: z.string().optional(),
          buildVersion: z.string().optional(),
          serialNumber: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await upsertDevice({ ...input, status: "connected", lastSeen: new Date() });
      }),

    updateStatus: publicProcedure
      .input(z.object({ id: z.number(), status: z.enum(["connected", "disconnected", "unknown"]) }))
      .mutation(async ({ input }) => {
        await updateDeviceStatus(input.id, input.status);
        return { success: true };
      }),

    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteDevice(input.id);
      return { success: true };
    }),
  }),

  // ─── IOC Files ──────────────────────────────────────────────────────────────
  ioc: router({
    list: publicProcedure.query(async () => {
      return await listIocFiles();
    }),

    upload: publicProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          content: z.string(), // base64 encoded file content
          filename: z.string(),
          fileSize: z.number().optional(),
          indicatorCount: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.content, "base64");
        const fileKey = `ioc/${Date.now()}-${input.filename}`;
        const { key, url } = await storagePut(fileKey, buffer, "application/json");

        // Count indicators from STIX2 content
        let indicatorCount = input.indicatorCount ?? 0;
        try {
          const text = buffer.toString("utf-8");
          const stix = JSON.parse(text);
          if (stix.objects) {
            indicatorCount = stix.objects.filter((o: any) => o.type === "indicator").length;
          }
        } catch {
          // Not valid JSON, use provided count
        }

        const iocFile = await createIocFile({
          name: input.name,
          description: input.description,
          fileKey: key,
          fileUrl: url,
          fileSize: input.fileSize ?? buffer.length,
          format: "stix2",
          indicatorCount,
          isActive: true,
        });
        return iocFile;
      }),

    toggleActive: publicProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        await updateIocFileActive(input.id, input.isActive);
        return { success: true };
      }),

    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteIocFile(input.id);
      return { success: true };
    }),
  }),

  // ─── Scan Tasks ─────────────────────────────────────────────────────────────
  scan: router({
    list: publicProcedure.query(async () => {
      return await listScanTasks();
    }),

    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const task = await getScanTaskById(input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

    create: publicProcedure
      .input(
        z.object({
          name: z.string(),
          deviceId: z.number().optional(),
          deviceUdid: z.string().optional(),
          scanType: z.enum(["encrypted_backup", "filesystem_dump", "sysdiagnose"]),
          iocFileIds: z.array(z.number()).optional(),
          // For file upload (base64)
          dataContent: z.string().optional(),
          dataFilename: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        let dataFileKey: string | undefined;

        // Handle uploaded data file
        if (input.dataContent && input.dataFilename) {
          const buffer = Buffer.from(input.dataContent, "base64");
          const fileKey = `scan-data/${Date.now()}-${input.dataFilename}`;
          const { key } = await storagePut(fileKey, buffer, "application/octet-stream");
          dataFileKey = key;
        }

        const task = await createScanTask({
          name: input.name,
          deviceId: input.deviceId,
          deviceUdid: input.deviceUdid,
          scanType: input.scanType,
          iocFileIds: input.iocFileIds ?? [],
          dataFileKey,
          status: "pending",
          progress: 0,
        });

        // Start detection asynchronously
        if (task) {
          startDetectionAsync(task.id, input.scanType);
        }

        return task;
      }),

    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteScanTask(input.id);
      return { success: true };
    }),

    results: publicProcedure.input(z.object({ taskId: z.number() })).query(async ({ input }) => {
      return await listScanResults(input.taskId);
    }),

    report: publicProcedure.input(z.object({ taskId: z.number() })).query(async ({ input }) => {
      const task = await getScanTaskById(input.taskId);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      const results = await listScanResults(input.taskId);
      const summary = (task.resultSummary as any) ?? {
        total: results.length,
        detected: results.filter((r) => r.isDetected).length,
        byObjectType: {},
        bySeverity: {},
      };

      // Get device info
      let deviceInfo = "未知设备";
      if (task.deviceId) {
        const device = await getDeviceById(task.deviceId);
        if (device) {
          deviceInfo = `${device.name ?? device.model ?? "iPhone"} (${device.iosVersion ?? "Unknown iOS"}, UDID: ${device.udid})`;
        }
      } else if (task.deviceUdid) {
        deviceInfo = `UDID: ${task.deviceUdid}`;
      }

      const scanTypeLabel: Record<string, string> = {
        encrypted_backup: "加密备份",
        filesystem_dump: "文件系统转储",
        sysdiagnose: "Sysdiagnose/日志目录",
      };

      const markdown = generateMarkdownReport(
        task.name,
        deviceInfo,
        scanTypeLabel[task.scanType] ?? task.scanType,
        results as any,
        summary
      );

      return { markdown, task, summary };
    }),
  }),
});

// ─── Async detection runner ───────────────────────────────────────────────────
async function startDetectionAsync(taskId: number, scanType: string) {
  try {
    await updateScanTask(taskId, {
      status: "running",
      progress: 0,
      progressMessage: "初始化检测引擎...",
      startedAt: new Date(),
    });

    const { results, summary } = await runDetection(
      scanType,
      true,
      async (progress, message) => {
        await updateScanTask(taskId, { progress, progressMessage: message });
      }
    );

    // Save results to DB
    await insertScanResults(
      results.map((r) => ({
        taskId,
        objectType: r.objectType,
        indicatorType: r.indicatorType,
        value: r.value,
        path: r.path,
        matchedText: r.matchedText,
        severity: r.severity,
        confidence: r.confidence,
        description: r.description,
        source: r.source,
        matchedIndicator: r.matchedIndicator,
        isDetected: r.isDetected,
        timestamp: r.timestamp,
      }))
    );

    await updateScanTask(taskId, {
      status: "completed",
      progress: 100,
      progressMessage: `检测完成，发现 ${summary.detected} 个威胁`,
      resultSummary: summary,
      completedAt: new Date(),
    });
  } catch (err: any) {
    await updateScanTask(taskId, {
      status: "failed",
      errorMessage: err?.message ?? "检测失败",
      completedAt: new Date(),
    });
  }
}

export type AppRouter = typeof appRouter;
