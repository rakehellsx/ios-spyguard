import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Core user table (Manus OAuth) ───────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Local accounts (username/password) ──────────────────────────────────────
export const localAccounts = mysqlTable("local_accounts", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 256 }).notNull(),
  displayName: text("displayName"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type LocalAccount = typeof localAccounts.$inferSelect;
export type InsertLocalAccount = typeof localAccounts.$inferInsert;

// ─── iOS Devices ──────────────────────────────────────────────────────────────
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  udid: varchar("udid", { length: 64 }).notNull().unique(),
  name: text("name"),
  model: text("model"),
  productType: varchar("productType", { length: 64 }),
  iosVersion: varchar("iosVersion", { length: 32 }),
  buildVersion: varchar("buildVersion", { length: 32 }),
  serialNumber: varchar("serialNumber", { length: 64 }),
  status: mysqlEnum("status", ["connected", "disconnected", "unknown"]).default("unknown").notNull(),
  lastSeen: timestamp("lastSeen").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  addedBy: int("addedBy"),
});

export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

// ─── IOC Rule Files ───────────────────────────────────────────────────────────
export const iocFiles = mysqlTable("ioc_files", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  fileKey: text("fileKey").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileSize: bigint("fileSize", { mode: "number" }),
  format: varchar("format", { length: 32 }).default("stix2"),
  indicatorCount: int("indicatorCount").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IocFile = typeof iocFiles.$inferSelect;
export type InsertIocFile = typeof iocFiles.$inferInsert;

// ─── Scan Tasks ───────────────────────────────────────────────────────────────
export const scanTasks = mysqlTable("scan_tasks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  deviceId: int("deviceId"),
  deviceUdid: varchar("deviceUdid", { length: 64 }),
  scanType: mysqlEnum("scanType", ["encrypted_backup", "filesystem_dump", "sysdiagnose"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).default("pending").notNull(),
  progress: int("progress").default(0),
  progressMessage: text("progressMessage"),
  dataPath: text("dataPath"),
  dataFileKey: text("dataFileKey"),
  iocFileIds: json("iocFileIds").$type<number[]>().default([]),
  resultSummary: json("resultSummary").$type<{
    total: number;
    detected: number;
    byObjectType: Record<string, number>;
    bySeverity: Record<string, number>;
  }>(),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScanTask = typeof scanTasks.$inferSelect;
export type InsertScanTask = typeof scanTasks.$inferInsert;

// ─── Scan Results ─────────────────────────────────────────────────────────────
export const scanResults = mysqlTable("scan_results", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  objectType: varchar("objectType", { length: 64 }).notNull(),
  indicatorType: varchar("indicatorType", { length: 64 }).notNull(),
  value: text("value"),
  path: text("path"),
  matchedText: text("matchedText"),
  severity: mysqlEnum("severity", ["critical", "high", "medium", "low", "informational"]).default("medium").notNull(),
  confidence: mysqlEnum("confidence", ["high", "medium", "low"]).default("medium").notNull(),
  description: text("description"),
  source: mysqlEnum("source", ["ioc", "heuristic"]).default("heuristic").notNull(),
  matchedIndicator: text("matchedIndicator"),
  isDetected: boolean("isDetected").default(false).notNull(),
  timestamp: varchar("timestamp", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScanResult = typeof scanResults.$inferSelect;
export type InsertScanResult = typeof scanResults.$inferInsert;
