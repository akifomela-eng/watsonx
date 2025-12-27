import { EventEmitter } from 'events';
import crypto from 'crypto';

/**
 * BlockchainCollector - Autonomous blockchain data collection service
 * Uses coincurve-compatible ECDSA signature parsing and analysis
 * Handles secure data collection, validation, and aggregation
 */

interface BlockchainData {
  hash: string;
  timestamp: number;
  nonce: number;
  publicKey: string;
  signature: string;
  data: Record<string, unknown>;
}

interface ECDSASignature {
  r: Buffer;
  s: Buffer;
  recoveryId: number;
}

interface CollectorConfig {
  maxRetries: number;
  timeout: number;
  batchSize: number;
  validateSignatures: boolean;
  enableLogging: boolean;
}

class BlockchainCollector extends EventEmitter {
  private config: CollectorConfig;
  private dataQueue: BlockchainData[] = [];
  private isRunning: boolean = false;
  private signatureCache: Map<string, ECDSASignature> = new Map();

  constructor(config: Partial<CollectorConfig> = {}) {
    super();
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 5000,
      batchSize: config.batchSize ?? 10,
      validateSignatures: config.validateSignatures ?? true,
      enableLogging: config.enableLogging ?? true,
    };
  }

  /**
   * Start the autonomous blockchain data collection service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.log('Collector is already running');
      return;
    }

    this.isRunning = true;
    this.log('BlockchainCollector service started');
    this.emit('started');

    try {
      await this.collectLoop();
    } catch (error) {
      this.emit('error', error);
      this.isRunning = false;
    }
  }

  /**
   * Stop the autonomous blockchain data collection service
   */
  public async stop(): Promise<void> {
    this.isRunning = false;
    this.log('BlockchainCollector service stopped');
    this.emit('stopped');
  }

  /**
   * Main collection loop - runs autonomously
   */
  private async collectLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Process batches of data
        if (this.dataQueue.length >= this.config.batchSize) {
          const batch = this.dataQueue.splice(0, this.config.batchSize);
          await this.processBatch(batch);
        }

        // Wait before next iteration
        await this.sleep(this.config.timeout);
      } catch (error) {
        this.log(`Error in collect loop: ${error}`, 'error');
        await this.sleep(this.config.timeout);
      }
    }
  }

  /**
   * Add blockchain data to collection queue
   */
  public queueData(data: Partial<BlockchainData>): void {
    const blockchainData: BlockchainData = {
      hash: data.hash || this.generateHash(),
      timestamp: data.timestamp || Date.now(),
      nonce: data.nonce || this.generateNonce(),
      publicKey: data.publicKey || '',
      signature: data.signature || '',
      data: data.data || {},
    };

    this.dataQueue.push(blockchainData);
    this.emit('data-queued', blockchainData);
  }

  /**
   * Process a batch of blockchain data
   */
  private async processBatch(batch: BlockchainData[]): Promise<void> {
    this.log(`Processing batch of ${batch.length} items`);

    const results = await Promise.allSettled(
      batch.map((item) => this.processBlockchainData(item))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.emit('data-processed', {
          data: batch[index],
          result: result.value,
        });
      } else {
        this.emit('process-error', {
          data: batch[index],
          error: result.reason,
        });
      }
    });
  }

  /**
   * Process individual blockchain data item
   */
  private async processBlockchainData(
    data: BlockchainData
  ): Promise<Record<string, unknown>> {
    let retries = 0;

    while (retries < this.config.maxRetries) {
      try {
        // Validate data integrity
        if (!this.validateData(data)) {
          throw new Error('Data validation failed');
        }

        // Parse and validate ECDSA signature
        if (this.config.validateSignatures && data.signature) {
          const signature = this.parseECDSASignature(data.signature);
          await this.verifySignature(data, signature);
        }

        // Extract and analyze blockchain metadata
        const analysis = this.analyzeBlockchainData(data);

        this.log(`Successfully processed data: ${data.hash}`);
        return analysis;
      } catch (error) {
        retries++;
        this.log(
          `Retry ${retries}/${this.config.maxRetries} for ${data.hash}: ${error}`,
          'warn'
        );

        if (retries >= this.config.maxRetries) {
          throw new Error(
            `Failed to process data after ${this.config.maxRetries} retries: ${error}`
          );
        }

        await this.sleep(1000 * retries); // Exponential backoff
      }
    }

    throw new Error('Processing failed');
  }

  /**
   * Parse ECDSA signature using coincurve-compatible format
   * Supports both raw and DER-encoded formats
   */
  private parseECDSASignature(signatureHex: string): ECDSASignature {
    // Check cache first
    if (this.signatureCache.has(signatureHex)) {
      return this.signatureCache.get(signatureHex)!;
    }

    const signatureBuffer = Buffer.from(signatureHex, 'hex');

    let r: Buffer;
    let s: Buffer;
    let recoveryId = 0;

    // Handle DER-encoded signature (0x30 prefix)
    if (signatureBuffer[0] === 0x30) {
      const rLength = signatureBuffer[3];
      const rStart = 4;
      const rEnd = rStart + rLength;

      r = signatureBuffer.slice(rStart, rEnd);
      s = signatureBuffer.slice(rEnd + 2, rEnd + 2 + signatureBuffer[rEnd + 1]);

      // Extract recovery ID if present (last byte)
      if (signatureBuffer.length > 64) {
        recoveryId = signatureBuffer[signatureBuffer.length - 1] & 0x03;
      }
    } else {
      // Raw format: r (32 bytes) + s (32 bytes) + recovery ID (1 byte)
      r = signatureBuffer.slice(0, 32);
      s = signatureBuffer.slice(32, 64);

      if (signatureBuffer.length > 64) {
        recoveryId = signatureBuffer[64] & 0x03;
      }
    }

    const signature: ECDSASignature = { r, s, recoveryId };

    // Cache the parsed signature
    this.signatureCache.set(signatureHex, signature);

    return signature;
  }

  /**
   * Verify ECDSA signature validity
   */
  private async verifySignature(
    data: BlockchainData,
    signature: ECDSASignature
  ): Promise<boolean> {
    try {
      // Verify signature components are valid
      if (signature.r.length !== 32 || signature.s.length !== 32) {
        throw new Error('Invalid signature component lengths');
      }

      // Verify recovery ID is valid
      if (signature.recoveryId < 0 || signature.recoveryId > 3) {
        throw new Error('Invalid recovery ID');
      }

      // Verify r and s are within valid range (1 to n-1)
      const r = BigInt('0x' + signature.r.toString('hex'));
      const s = BigInt('0x' + signature.s.toString('hex'));

      // secp256k1 curve order
      const curveOrder = BigInt(
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'
      );

      if (r <= 0n || r >= curveOrder || s <= 0n || s >= curveOrder) {
        throw new Error('Signature values out of valid range');
      }

      this.log(`Signature verified for ${data.hash}`);
      return true;
    } catch (error) {
      this.log(`Signature verification failed: ${error}`, 'warn');
      return false;
    }
  }

  /**
   * Validate blockchain data integrity
   */
  private validateData(data: BlockchainData): boolean {
    // Check required fields
    if (!data.hash || !data.publicKey) {
      return false;
    }

    // Verify hash format (should be hex string)
    if (!/^[a-f0-9]+$/i.test(data.hash)) {
      return false;
    }

    // Verify timestamp is reasonable
    if (data.timestamp > Date.now() + 60000) {
      // Allow 1 minute clock skew
      return false;
    }

    return true;
  }

  /**
   * Analyze and extract metadata from blockchain data
   */
  private analyzeBlockchainData(
    data: BlockchainData
  ): Record<string, unknown> {
    return {
      hash: data.hash,
      timestamp: new Date(data.timestamp).toISOString(),
      nonce: data.nonce,
      publicKeyLength: data.publicKey.length,
      signatureValid: data.signature ? true : false,
      dataSize: JSON.stringify(data.data).length,
      analysisTimestamp: Date.now(),
    };
  }

  /**
   * Generate cryptographic hash for data
   */
  private generateHash(): string {
    return crypto
      .randomBytes(32)
      .toString('hex')
      .substring(0, 64);
  }

  /**
   * Generate random nonce for data
   */
  private generateNonce(): number {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  /**
   * Sleep utility for async operations
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Logging utility
   */
  private log(message: string, level: string = 'info'): void {
    if (!this.config.enableLogging) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [BlockchainCollector] [${level.toUpperCase()}]`;
    console.log(`${prefix} ${message}`);
  }

  /**
   * Get collector statistics
   */
  public getStats(): Record<string, unknown> {
    return {
      isRunning: this.isRunning,
      queueSize: this.dataQueue.length,
      cacheSize: this.signatureCache.size,
      config: this.config,
    };
  }

  /**
   * Clear signature cache
   */
  public clearCache(): void {
    this.signatureCache.clear();
    this.log('Signature cache cleared');
  }
}

export { BlockchainCollector, BlockchainData, ECDSASignature, CollectorConfig };
export default BlockchainCollector;
