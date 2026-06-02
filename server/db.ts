import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  localAccounts,
  devices,
  iocFiles,
  scanTasks,
  scanResults,
  type InsertLocalAccount,
  type InsertDevice,
  type InsertIocFile,
  type InsertScanTask,
  type InsertScanResult,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users (Manus OAuth) ──────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Local Accounts ───────────────────────────────────────────────────────────
export async function createLocalAccount(data: InsertLocalAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(localAccounts).values(data);
  return result;
}

export async function getLocalAccountByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(localAccounts).where(eq(localAccounts.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getLocalAccountById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(localAccounts).where(eq(localAccounts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateLocalAccountLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(localAccounts).set({ lastSignedIn: new Date() }).where(eq(localAccounts.id, id));
}

export async function countLocalAccounts() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(localAccounts);
  return Number(result[0]?.count ?? 0);
}

// ─── Devices ──────────────────────────────────────────────────────────────────
export async function listDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(devices).orderBy(desc(devices.lastSeen));
}

export async function getDeviceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertDevice(data: InsertDevice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(devices).values(data).onDuplicateKeyUpdate({
    set: {
      name: data.name,
      model: data.model,
      productType: data.productType,
      iosVersion: data.iosVersion,
      buildVersion: data.buildVersion,
      serialNumber: data.serialNumber,
      status: data.status,
      lastSeen: new Date(),
    },
  });
  const result = await db.select().from(devices).where(eq(devices.udid, data.udid!)).limit(1);
  return result[0];
}

export async function updateDeviceStatus(id: number, status: "connected" | "disconnected" | "unknown") {
  const db = await getDb();
  if (!db) return;
  await db.update(devices).set({ status, lastSeen: new Date() }).where(eq(devices.id, id));
}

export async function deleteDevice(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(devices).where(eq(devices.id, id));
}

export async function countDevices() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(devices);
  return Number(result[0]?.count ?? 0);
}

// ─── IOC Files ────────────────────────────────────────────────────────────────
export async function listIocFiles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(iocFiles).orderBy(desc(iocFiles.createdAt));
}

export async function getIocFileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(iocFiles).where(eq(iocFiles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createIocFile(data: InsertIocFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(iocFiles).values(data);
  const insertId = (result as any)[0]?.insertId;
  return getIocFileById(insertId);
}

export async function updateIocFileActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(iocFiles).set({ isActive }).where(eq(iocFiles.id, id));
}

export async function deleteIocFile(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(iocFiles).where(eq(iocFiles.id, id));
}

// ─── Scan Tasks ───────────────────────────────────────────────────────────────
export async function listScanTasks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanTasks).orderBy(desc(scanTasks.createdAt));
}

export async function getScanTaskById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scanTasks).where(eq(scanTasks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createScanTask(data: InsertScanTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scanTasks).values(data);
  const insertId = (result as any)[0]?.insertId;
  return getScanTaskById(insertId);
}

export async function updateScanTask(
  id: number,
  data: Partial<{
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    progress: number;
    progressMessage: string;
    resultSummary: any;
    errorMessage: string;
    startedAt: Date;
    completedAt: Date;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(scanTasks).set(data as any).where(eq(scanTasks.id, id));
}

export async function deleteScanTask(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(scanResults).where(eq(scanResults.taskId, id));
  await db.delete(scanTasks).where(eq(scanTasks.id, id));
}

export async function countScanTasks() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(scanTasks);
  return Number(result[0]?.count ?? 0);
}

// ─── Scan Results ─────────────────────────────────────────────────────────────
export async function listScanResults(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scanResults).where(eq(scanResults.taskId, taskId)).orderBy(
    sql`FIELD(severity,'critical','high','medium','low','informational')`
  );
}

export async function insertScanResults(results: InsertScanResult[]) {
  const db = await getDb();
  if (!db) return;
  if (results.length === 0) return;
  // Insert in batches of 50
  for (let i = 0; i < results.length; i += 50) {
    await db.insert(scanResults).values(results.slice(i, i + 50));
  }
}

export async function countTotalThreats() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(scanResults)
    .where(eq(scanResults.isDetected, true));
  return Number(result[0]?.count ?? 0);
}
