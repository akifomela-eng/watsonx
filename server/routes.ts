import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Scans
  app.get(api.scans.list.path, async (req, res) => {
    const scans = await storage.getScans();
    res.json(scans);
  });

  app.post(api.scans.create.path, async (req, res) => {
    try {
      const input = api.scans.create.input.parse(req.body);
      const scan = await storage.createScan(input);
      
      // Simulate Async Processing (Watsonx + Scanner)
      processScanInBackground(scan.id, scan.target);

      res.status(201).json(scan);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.scans.get.path, async (req, res) => {
    const id = Number(req.params.id);
    const scan = await storage.getScan(id);
    if (!scan) {
      return res.status(404).json({ message: 'Scan not found' });
    }
    
    const result = await storage.getScanResult(id);
    const decision = await storage.getDecision(id);

    res.json({ ...scan, result, decision });
  });

  // Schedules
  app.get(api.schedules.list.path, async (req, res) => {
    const schedules = await storage.getSchedules();
    res.json(schedules);
  });

  app.post(api.schedules.create.path, async (req, res) => {
    try {
      const input = api.schedules.create.input.parse(req.body);
      const schedule = await storage.createSchedule(input);
      res.status(201).json(schedule);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.schedules.toggle.path, async (req, res) => {
    const id = Number(req.params.id);
    const { isActive } = req.body;
    const schedule = await storage.toggleSchedule(id, isActive);
    res.json(schedule);
  });

  // Dashboard Stats
  app.get(api.dashboard.stats.path, async (req, res) => {
    const stats = await storage.getStats();
    const recentDecisions = await storage.getRecentDecisions(5);
    res.json({ ...stats, recentDecisions });
  });

  // Seed Data on Startup
  await seedDatabase();

  return httpServer;
}

// Mock Background Processing
async function processScanInBackground(scanId: number, target: string) {
  console.log(`Starting background scan for ${scanId}...`);
  
  // 1. Simulate Scanner delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  await storage.updateScanStatus(scanId, "processing");

  // 2. Simulate Result Generation (Scanner -> Blockchain -> ECDSA)
  const isVulnerable = Math.random() > 0.5; // Randomly vulnerable for demo
  await storage.createScanResult({
    scanId,
    rawData: { signature: "0x...", r: "0x...", s: "0x..." },
    vulnerabilityScore: isVulnerable ? 85 : 10,
    findings: isVulnerable 
      ? "Detected repeated R value in ECDSA signature. Private key recovery possible."
      : "No critical ECDSA vulnerabilities found."
  });

  // 3. Simulate Watsonx Decision (Granite)
  // In a real app, we would call: client.generate(prompt)
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const priority = isVulnerable ? "critical" : "low";
  const reasoning = isVulnerable
    ? "Watsonx Granite analysis indicates a high probability of private key leakage due to nonce reuse. Immediate action required."
    : "Routine scan completed. No anomalies detected in the signature patterns.";

  await storage.createDecision({
    scanId,
    priority,
    reasoning,
    modelUsed: "ibm/granite-13b-chat-v2",
    confidence: isVulnerable ? 98 : 95
  });

  await storage.updateScanStatus(scanId, "completed");
  console.log(`Scan ${scanId} completed.`);
}

async function seedDatabase() {
  const scans = await storage.getScans();
  if (scans.length === 0) {
    // Seed a few scans
    const scan1 = await storage.createScan({
      target: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      status: "completed",
      type: "ecdsa_analysis"
    });
    
    await storage.createScanResult({
      scanId: scan1.id,
      rawData: { signature: "0xabc..." },
      vulnerabilityScore: 12,
      findings: "Safe parameters observed."
    });

    await storage.createDecision({
      scanId: scan1.id,
      priority: "low",
      reasoning: "Standard transaction pattern verified. No threat.",
      modelUsed: "ibm/granite-13b-chat-v2",
      confidence: 99
    });

    await storage.createSchedule({
      name: "Daily Mainnet Scan",
      cronExpression: "0 0 * * *",
      target: "0x742d...f44e",
      isActive: true
    });
  }
}
