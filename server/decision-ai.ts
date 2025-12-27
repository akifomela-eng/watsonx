/**
 * Decision AI using Watsonx Granite for action selection
 * Determines whether to scan, deep scan, or sleep based on state
 */

import { callWatsonxAPI } from "./watsonx";

export type DecisionAction = "SCAN" | "DEEP" | "SLEEP";

export interface DecisionState {
  address: string;
  priority: "H" | "M" | "L";
  risk: number; // 0-100
  depth: number; // 1-3
  lastScanned?: string; // ISO timestamp
}

export interface DecisionResult {
  action: DecisionAction;
  reasoning: string;
  confidence: number; // 0-100
}

export class DecisionAI {
  /**
   * Make a decision based on the current state using Watsonx Granite
   */
  async decide(state: DecisionState): Promise<DecisionResult> {
    const prompt = `
You are a security analyst AI. Make a decision on how to proceed with scanning a blockchain address.

Current State:
- Address: ${state.address}
- Priority: ${state.priority} (H=Critical, M=Medium, L=Low)
- Risk Level: ${state.risk}/100
- Analysis Depth: Level ${state.depth}/3
- Last Scanned: ${state.lastScanned || "Never"}

Available Actions:
- SCAN: Run standard ECDSA vulnerability scan
- DEEP: Run comprehensive deep analysis with polynomial attack detection
- SLEEP: Skip this address and check again later

Consider:
1. High priority (H) addresses should be scanned immediately
2. High risk (>70) addresses need deep analysis
3. Recently scanned addresses can sleep
4. Medium priority needs standard scan only

Respond with ONLY valid JSON:
{"action":"SCAN|DEEP|SLEEP","reasoning":"brief explanation","confidence":0-100}
`;

    try {
      // Try to use real Watsonx API if credentials available
      if (process.env.WATSONX_API_KEY) {
        const response = await callWatsonxAPI(prompt);
        return this.parseDecisionResponse(response);
      }
    } catch (error) {
      console.warn("Watsonx API unavailable, using fallback decision logic");
    }

    // Fallback: deterministic decision logic
    return this.fallbackDecide(state);
  }

  private parseDecisionResponse(response: string): DecisionResult {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action as DecisionAction,
        reasoning: parsed.reasoning,
        confidence: parsed.confidence,
      };
    } catch (error) {
      console.error("Failed to parse decision response:", error);
      return {
        action: "SLEEP",
        reasoning: "Error parsing AI decision, defaulting to sleep",
        confidence: 0,
      };
    }
  }

  private fallbackDecide(state: DecisionState): DecisionResult {
    // Deterministic fallback logic
    if (state.priority === "H") {
      if (state.risk > 70) {
        return {
          action: "DEEP",
          reasoning: "Critical priority with high risk requires deep analysis",
          confidence: 98,
        };
      }
      return {
        action: "SCAN",
        reasoning: "Critical priority address needs immediate scan",
        confidence: 95,
      };
    }

    if (state.priority === "M") {
      if (state.risk > 60) {
        return {
          action: "SCAN",
          reasoning: "Medium priority with elevated risk warrants scan",
          confidence: 85,
        };
      }
      return {
        action: "SLEEP",
        reasoning: "Medium priority with normal risk, will check again later",
        confidence: 80,
      };
    }

    // Low priority
    if (state.risk > 80) {
      return {
        action: "SCAN",
        reasoning: "Low priority but unusually high risk detected",
        confidence: 75,
      };
    }

    return {
      action: "SLEEP",
      reasoning: "Low priority and normal risk, no action needed",
      confidence: 90,
    };
  }
}

export const decisionAI = new DecisionAI();
