import { db } from "./db";
import {
  scans, scanResults, decisions, schedules,
  type Scan, type InsertScan,
  type ScanResult, type InsertScanResult,
  type Decision, type InsertDecision,
  type Schedule, type InsertSchedule
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Scans
  getScans(): Promise<Scan[]>;
  getScan(id: number): Promise<Scan | undefined>;
  createScan(scan: InsertScan): Promise<Scan>;
  updateScanStatus(id: number, status: string): Promise<Scan>;

  // Results
  getScanResult(scanId: number): Promise<ScanResult | undefined>;
  createScanResult(result: InsertScanResult): Promise<ScanResult>;

  // Decisions
  getDecision(scanId: number): Promise<Decision | undefined>;
  createDecision(decision: InsertDecision): Promise<Decision>;
  getRecentDecisions(limit?: number): Promise<Decision[]>;

  // Schedules
  getSchedules(): Promise<Schedule[]>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  toggleSchedule(id: number, isActive: boolean): Promise<Schedule>;
  
  // Dashboard
  getStats(): Promise<{ totalScans: number, criticalVulnerabilities: number, activeSchedules: number }>;
}

export class DatabaseStorage implements IStorage {
  async getScans(): Promise<Scan[]> {
    return await db.select().from(scans).orderBy(desc(scans.createdAt));
  }

  async getScan(id: number): Promise<Scan | undefined> {
    const [scan] = await db.select().from(scans).where(eq(scans.id, id));
    return scan;
  }

  async createScan(scan: InsertScan): Promise<Scan> {
    const [newScan] = await db.insert(scans).values(scan).returning();
    return newScan;
  }

  async updateScanStatus(id: number, status: string): Promise<Scan> {
    const [updated] = await db.update(scans)
      .set({ status })
      .where(eq(scans.id, id))
      .returning();
    return updated;
  }

  async getScanResult(scanId: number): Promise<ScanResult | undefined> {
    const [result] = await db.select().from(scanResults).where(eq(scanResults.scanId, scanId));
    return result;
  }

  async createScanResult(result: InsertScanResult): Promise<ScanResult> {
    const [newResult] = await db.insert(scanResults).values(result).returning();
    return newResult;
  }

  async getDecision(scanId: number): Promise<Decision | undefined> {
    const [decision] = await db.select().from(decisions).where(eq(decisions.scanId, scanId));
    return decision;
  }

  async createDecision(decision: InsertDecision): Promise<Decision> {
    const [newDecision] = await db.insert(decisions).values(decision).returning();
    return newDecision;
  }

  async getRecentDecisions(limit = 5): Promise<Decision[]> {
    return await db.select().from(decisions).orderBy(desc(decisions.createdAt)).limit(limit);
  }

  async getSchedules(): Promise<Schedule[]> {
    return await db.select().from(schedules);
  }

  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const [newSchedule] = await db.insert(schedules).values(schedule).returning();
    return newSchedule;
  }

  async toggleSchedule(id: number, isActive: boolean): Promise<Schedule> {
    const [updated] = await db.update(schedules)
      .set({ isActive })
      .where(eq(schedules.id, id))
      .returning();
    return updated;
  }

  async getStats() {
    const allScans = await db.select().from(scans);
    const criticalDecisions = await db.select().from(decisions).where(eq(decisions.priority, 'critical'));
    const activeSchedules = await db.select().from(schedules).where(eq(schedules.isActive, true));

    return {
      totalScans: allScans.length,
      criticalVulnerabilities: criticalDecisions.length,
      activeSchedules: activeSchedules.length
    };
  }
}

export const storage = new DatabaseStorage();
