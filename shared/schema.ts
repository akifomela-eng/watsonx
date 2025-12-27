import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === SCANS ===
export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  target: text("target").notNull(), // Blockchain address or transaction hash
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
  type: text("type").default("ecdsa_analysis").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// === RESULTS ===
export const scanResults = pgTable("scan_results", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").notNull(),
  rawData: jsonb("raw_data"), // The raw output from the scanner
  vulnerabilityScore: integer("vulnerability_score"),
  findings: text("findings"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === DECISIONS (Watsonx) ===
export const decisions = pgTable("decisions", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").notNull(),
  priority: text("priority", { enum: ["critical", "high", "medium", "low"] }).notNull(),
  reasoning: text("reasoning").notNull(), // AI explanation
  modelUsed: text("model_used").default("granite").notNull(),
  confidence: integer("confidence"), // 0-100
  createdAt: timestamp("created_at").defaultNow(),
});

// === SCHEDULES ===
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cronExpression: text("cron_expression").notNull(),
  target: text("target").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastRun: timestamp("last_run"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === SCHEMAS ===
export const insertScanSchema = createInsertSchema(scans).omit({ id: true, createdAt: true, completedAt: true });
export const insertScheduleSchema = createInsertSchema(schedules).omit({ id: true, createdAt: true, lastRun: true });
export const insertDecisionSchema = createInsertSchema(decisions).omit({ id: true, createdAt: true });
export const insertScanResultSchema = createInsertSchema(scanResults).omit({ id: true, createdAt: true });

// === TYPES ===
export type Scan = typeof scans.$inferSelect;
export type InsertScan = z.infer<typeof insertScanSchema>;

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

export type Decision = typeof decisions.$inferSelect;
export type ScanResult = typeof scanResults.$inferSelect;
