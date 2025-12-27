/**
 * Blockchain Scanner for ECDSA vulnerability detection
 * Checks for nonce reuse, polynomial attacks, and weak nonces
 */

export interface Signature {
  r: string;
  s: string;
  v: number;
  hash: string;
}

export interface ScanResult {
  type: "nonce_reuse" | "polynomial_attack" | "weak_nonce";
  details: string;
  severity: number; // 0-100
}

export class Scanner {
  /**
   * Scan a blockchain address for ECDSA vulnerabilities
   * Returns null if insufficient signatures or no vulnerabilities found
   */
  async scan(addr: string): Promise<ScanResult | null> {
    const sigs = await this.extractSignatures(addr);

    if (sigs.length < 2) {
      return null;
    }

    // Check for vulnerabilities in order of severity
    return (
      this.nonceReuse(sigs) ||
      this.polynomialAttack(sigs) ||
      this.weakNonce(sigs) ||
      null
    );
  }

  /**
   * Extract signatures from transactions for a given address
   * In production, this would fetch from blockchain RPC
   */
  private async extractSignatures(addr: string): Promise<Signature[]> {
    // Mock implementation - in production, fetch from ethers.js or Web3.js
    // using: provider.getHistory(addr) then extract r,s,v values

    // Simulate fetching transaction signatures
    const mockSigs: Signature[] = [
      {
        r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        s: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
        v: 27,
        hash: "0xhash1",
      },
      {
        r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        s: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
        v: 28,
        hash: "0xhash2",
      },
    ];

    return mockSigs;
  }

  /**
   * Check for nonce reuse (same R value across signatures)
   * This is a critical vulnerability allowing private key recovery
   */
  private nonceReuse(sigs: Signature[]): ScanResult | null {
    const rValues = new Map<string, number>();

    for (const sig of sigs) {
      const count = (rValues.get(sig.r) || 0) + 1;
      rValues.set(sig.r, count);
    }

    for (const [r, count] of rValues) {
      if (count > 1) {
        return {
          type: "nonce_reuse",
          details: `Found ${count} signatures with same R value (${r.substring(0, 10)}...). Private key recovery is possible.`,
          severity: 95,
        };
      }
    }

    return null;
  }

  /**
   * Check for polynomial attack (weak nonce generation patterns)
   */
  private polynomialAttack(sigs: Signature[]): ScanResult | null {
    if (sigs.length < 3) return null;

    // Check if R values follow a predictable pattern (polynomial sequence)
    const rInts = sigs.map((s) => BigInt(s.r));

    // Calculate differences between consecutive R values
    const diffs: bigint[] = [];
    for (let i = 1; i < rInts.length; i++) {
      diffs.push(rInts[i] - rInts[i - 1]);
    }

    // Check if differences themselves form a pattern (second derivative)
    if (diffs.length >= 2) {
      const secondDiffs: bigint[] = [];
      for (let i = 1; i < diffs.length; i++) {
        secondDiffs.push(diffs[i] - diffs[i - 1]);
      }

      // If second derivatives are zero or very small, polynomial generation detected
      const isPolynomial = secondDiffs.every((d) => d === 0n || (d > 0n && d < 1000n));

      if (isPolynomial) {
        return {
          type: "polynomial_attack",
          details: "Detected polynomial nonce generation pattern. Nonce sequence is predictable.",
          severity: 85,
        };
      }
    }

    return null;
  }

  /**
   * Check for weak nonce generation (low entropy)
   */
  private weakNonce(sigs: Signature[]): ScanResult | null {
    // Check if nonce values are suspiciously small or follow patterns
    const rInts = sigs.map((s) => BigInt(s.r));
    const maxR = BigInt(
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
    );

    const weakCount = rInts.filter((r) => r < maxR / 1000n).length;

    if (weakCount > sigs.length * 0.3) {
      // More than 30% of nonces are suspiciously small
      return {
        type: "weak_nonce",
        details: `${weakCount} out of ${sigs.length} signatures use low-entropy nonces.`,
        severity: 70,
      };
    }

    return null;
  }
}

export const scanner = new Scanner();
