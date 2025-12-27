/**
 * Main scanning loop: prioritize addresses, scan high-priority ones, store vulnerabilities
 * Implements the continuous monitoring workflow
 */

import { storage } from "./storage";
import { prioritize } from "./watsonx";
import { scanner } from "./scanner";
import { decisionAI, type DecisionState } from "./decision-ai";

export class MainScannerLoop {
  private isRunning = false;
  private interval: NodeJS.Timer | null = null;

  /**
   * Start the continuous scanning loop
   */
  start(intervalSeconds: number = 30) {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`Scanner started. Checking addresses every ${intervalSeconds}s`);

    this.interval = setInterval(() => {
      this.scanCycle();
    }, intervalSeconds * 1000);
  }

  /**
   * Stop the scanning loop
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log("Scanner stopped");
  }

  /**
   * Single scan cycle: prioritize, decide, scan, store
   */
  private async scanCycle() {
    try {
      // Get next address to check (from schedules or queue)
      const addresses = await this.getAddressesToCheck();

      for (const addr of addresses) {
        await this.processAddress(addr);
      }
    } catch (error) {
      console.error("Error in scan cycle:", error);
    }
  }

  /**
   * Process a single address: prioritize, decide, scan, store
   */
  private async processAddress(addr: string) {
    try {
      // 1. Prioritize: Get priority level and risk from Watsonx
      const prioritization = await prioritize(addr);

      // 2. Decide: Use DecisionAI to determine action
      const decisionState: DecisionState = {
        address: addr,
        priority: prioritization.priority,
        risk: prioritization.risk,
        depth: prioritization.depth,
      };

      const decision = await decisionAI.decide(decisionState);

      // 3. Execute decision
      if (decision.action === "SLEEP") {
        console.log(
          `[SLEEP] ${addr.substring(0, 10)}... - ${decision.reasoning}`
        );
        return;
      }

      if (decision.action === "SCAN" || decision.action === "DEEP") {
        // 4. Run scanner
        const vulnerability = await scanner.scan(addr);

        if (vulnerability) {
          // 5. Store vulnerability
          const stored = await storage.storeVulnerability({
            address: addr,
            type: vulnerability.type,
            metadata: { details: vulnerability.details, severity: vulnerability.severity },
            severity: vulnerability.severity,
          });

          console.log(
            `[VULNERABILITY] ${addr.substring(0, 10)}... - Type: ${vulnerability.type}, Severity: ${vulnerability.severity}`
          );

          // Log the decision
          console.log(
            `[DECISION] Action: ${decision.action}, Confidence: ${decision.confidence}%, Reasoning: ${decision.reasoning}`
          );
        } else {
          console.log(`[SCAN] ${addr.substring(0, 10)}... - No vulnerabilities found`);
        }
      }
    } catch (error) {
      console.error(`Error processing address ${addr}:`, error);
    }
  }

  /**
   * Get addresses to check from database schedules
   */
  private async getAddressesToCheck(): Promise<string[]> {
    const schedules = await storage.getSchedules();
    return schedules.filter((s) => s.isActive).map((s) => s.target);
  }
}

export const mainScanner = new MainScannerLoop();
