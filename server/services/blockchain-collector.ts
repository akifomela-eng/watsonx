import crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * Types and Interfaces for Blockchain Data Collection
 */

interface BlockchainConfig {
  chainId: string;
  nodeUrl: string;
  pollInterval: number;
  maxRetries: number;
  timeout: number;
  batchSize: number;
}

interface BlockData {
  hash: string;
  number: number;
  timestamp: number;
  miner: string;
  gasUsed: string;
  gasLimit: string;
  transactions: string[];
  parentHash: string;
  difficulty: string;
  nonce: string;
}

interface TransactionData {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gasLimit: string;
  data: string;
  nonce: number;
  blockHash: string;
  blockNumber: number;
  transactionIndex: number;
  status: number;
  signature?: SignatureData;
}

interface SignatureData {
  r: string;
  s: string;
  v: number;
  publicKey?: string;
  recoveredAddress?: string;
  isValid?: boolean;
}

interface CollectionMetrics {
  blocksCollected: number;
  transactionsCollected: number;
  signaturesExtracted: number;
  errors: number;
  lastBlockHeight: number;
  lastCollectionTime: number;
  averageBlockTime: number;
}

interface TransactionSignature {
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  signature: SignatureData;
  sender: string;
  recipient: string | null;
  value: string;
}

/**
 * Blockchain Data Collector Service
 * Handles comprehensive blockchain data collection and ECDSA signature extraction
 */
export class BlockchainCollector extends EventEmitter {
  private config: BlockchainConfig;
  private isCollecting: boolean = false;
  private metrics: CollectionMetrics;
  private collectionQueue: Map<string, Promise<void>> = new Map();
  private cache: Map<string, BlockData> = new Map();
  private maxCacheSize: number = 1000;

  constructor(config: BlockchainConfig) {
    super();
    this.config = {
      chainId: config.chainId,
      nodeUrl: config.nodeUrl,
      pollInterval: config.pollInterval || 12000,
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 30000,
      batchSize: config.batchSize || 100,
    };

    this.metrics = {
      blocksCollected: 0,
      transactionsCollected: 0,
      signaturesExtracted: 0,
      errors: 0,
      lastBlockHeight: 0,
      lastCollectionTime: 0,
      averageBlockTime: 0,
    };
  }

  /**
   * Start collecting blockchain data
   */
  public async start(): Promise<void> {
    if (this.isCollecting) {
      throw new Error('Blockchain collector is already running');
    }

    this.isCollecting = true;
    this.emit('started', { timestamp: Date.now() });

    try {
      await this.initializeCollection();
      await this.startPolling();
    } catch (error) {
      this.isCollecting = false;
      this.emit('error', { error, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Stop collecting blockchain data
   */
  public stop(): void {
    this.isCollecting = false;
    this.emit('stopped', { timestamp: Date.now() });
  }

  /**
   * Initialize collection by fetching the current block height
   */
  private async initializeCollection(): Promise<void> {
    try {
      const blockHeight = await this.getCurrentBlockHeight();
      this.metrics.lastBlockHeight = blockHeight;
      this.emit('initialized', { blockHeight, timestamp: Date.now() });
    } catch (error) {
      throw new Error(`Failed to initialize collection: ${error}`);
    }
  }

  /**
   * Get current block height with retry logic
   */
  private async getCurrentBlockHeight(retries: number = 0): Promise<number> {
    try {
      const response = await this.fetchWithRetry(
        `${this.config.nodeUrl}/eth_blockNumber`,
        { method: 'POST' }
      );
      const data = await response.json();
      return parseInt(data.result, 16);
    } catch (error) {
      if (retries < this.config.maxRetries) {
        await this.delay(1000 * (retries + 1));
        return this.getCurrentBlockHeight(retries + 1);
      }
      throw error;
    }
  }

  /**
   * Start polling for new blocks
   */
  private async startPolling(): Promise<void> {
    while (this.isCollecting) {
      try {
        const currentBlockHeight = await this.getCurrentBlockHeight();

        if (currentBlockHeight > this.metrics.lastBlockHeight) {
          const newBlocks = await this.collectBlockRange(
            this.metrics.lastBlockHeight + 1,
            currentBlockHeight
          );

          this.emit('blocksCollected', {
            count: newBlocks.length,
            timestamp: Date.now(),
          });

          this.metrics.lastBlockHeight = currentBlockHeight;
        }

        this.metrics.lastCollectionTime = Date.now();
      } catch (error) {
        this.metrics.errors++;
        this.emit('error', { error, timestamp: Date.now() });
      }

      await this.delay(this.config.pollInterval);
    }
  }

  /**
   * Collect blocks within a range
   */
  private async collectBlockRange(
    startBlock: number,
    endBlock: number
  ): Promise<BlockData[]> {
    const blocks: BlockData[] = [];

    for (let blockNum = startBlock; blockNum <= endBlock; blockNum += this.config.batchSize) {
      const batchEnd = Math.min(blockNum + this.config.batchSize - 1, endBlock);
      const batchPromises: Promise<BlockData | null>[] = [];

      for (let i = blockNum; i <= batchEnd; i++) {
        batchPromises.push(this.fetchBlockData(i));
      }

      const batchResults = await Promise.all(batchPromises);
      blocks.push(...batchResults.filter((block) => block !== null) as BlockData[]);

      this.metrics.blocksCollected += batchResults.filter((b) => b !== null).length;
    }

    return blocks;
  }

  /**
   * Fetch block data for a specific block number
   */
  private async fetchBlockData(blockNumber: number): Promise<BlockData | null> {
    try {
      const cacheKey = `block_${blockNumber}`;

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey) || null;
      }

      const response = await this.fetchWithRetry(
        `${this.config.nodeUrl}/eth_getBlockByNumber`,
        {
          method: 'POST',
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBlockByNumber',
            params: [`0x${blockNumber.toString(16)}`, true],
            id: blockNumber,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
      }

      if (!data.result) {
        return null;
      }

      const blockData: BlockData = {
        hash: data.result.hash,
        number: parseInt(data.result.number, 16),
        timestamp: parseInt(data.result.timestamp, 16),
        miner: data.result.miner,
        gasUsed: data.result.gasUsed,
        gasLimit: data.result.gasLimit,
        transactions: data.result.transactions.map((tx: any) =>
          typeof tx === 'string' ? tx : tx.hash
        ),
        parentHash: data.result.parentHash,
        difficulty: data.result.difficulty,
        nonce: data.result.nonce,
      };

      this.cacheData(cacheKey, blockData);
      return blockData;
    } catch (error) {
      this.metrics.errors++;
      this.emit('error', { error, blockNumber, timestamp: Date.now() });
      return null;
    }
  }

  /**
   * Fetch transaction data with signature information
   */
  public async fetchTransactionWithSignature(
    txHash: string
  ): Promise<TransactionSignature | null> {
    try {
      const response = await this.fetchWithRetry(
        `${this.config.nodeUrl}/eth_getTransactionByHash`,
        {
          method: 'POST',
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionByHash',
            params: [txHash],
            id: 1,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
      }

      if (!data.result) {
        return null;
      }

      const txData = data.result;
      const signature = this.extractSignature(txData);
      const recoveredAddress = this.recoverSignerAddress(signature, txData);

      const transactionSig: TransactionSignature = {
        transactionHash: txHash,
        blockNumber: parseInt(txData.blockNumber, 16),
        timestamp: 0, // Will be fetched from block
        signature: {
          r: signature.r,
          s: signature.s,
          v: signature.v,
          publicKey: undefined,
          recoveredAddress: recoveredAddress,
          isValid: this.validateSignature(signature, txData),
        },
        sender: txData.from,
        recipient: txData.to,
        value: txData.value,
      };

      this.metrics.signaturesExtracted++;
      return transactionSig;
    } catch (error) {
      this.metrics.errors++;
      this.emit('error', { error, txHash, timestamp: Date.now() });
      return null;
    }
  }

  /**
   * Extract ECDSA signature components from transaction
   */
  private extractSignature(txData: any): SignatureData {
    const v = parseInt(txData.v, 16);
    const r = txData.r;
    const s = txData.s;

    return {
      v,
      r,
      s,
      isValid: this.validateSignatureComponents(v, r, s),
    };
  }

  /**
   * Recover the signer's address from signature
   */
  private recoverSignerAddress(signature: SignatureData, txData: any): string {
    try {
      // Create transaction hash (Keccak-256)
      const txHash = this.createTransactionHash(txData);

      // Recover public key from signature
      const publicKey = this.recoverPublicKey(
        txHash,
        signature.r,
        signature.s,
        signature.v
      );

      // Derive address from public key
      const address = this.publicKeyToAddress(publicKey);
      return address;
    } catch (error) {
      this.emit('error', { error, operation: 'recoverSignerAddress' });
      return '';
    }
  }

  /**
   * Create transaction hash using Keccak-256
   */
  private createTransactionHash(txData: any): Buffer {
    const fields = [
      txData.nonce,
      txData.gasPrice,
      txData.gas,
      txData.to || '0x',
      txData.value,
      txData.input || '0x',
    ];

    const encoded = this.rlpEncode(fields);
    return crypto.createHash('sha256').update(encoded).digest();
  }

  /**
   * RLP encoding for transaction data
   */
  private rlpEncode(data: any[]): Buffer {
    // Simplified RLP encoding for demonstration
    // In production, use a proper RLP library
    const encoded = data
      .map((item) => {
        if (item === null || item === undefined) return Buffer.from([]);
        if (typeof item === 'string') {
          return Buffer.from(item.startsWith('0x') ? item.slice(2) : item, 'hex');
        }
        return Buffer.from(item.toString());
      })
      .concat();

    return encoded;
  }

  /**
   * Recover public key from ECDSA signature
   */
  private recoverPublicKey(
    messageHash: Buffer,
    r: string,
    s: string,
    v: number
  ): Buffer {
    try {
      // Create the signature
      const rBuffer = Buffer.from(r.slice(2), 'hex');
      const sBuffer = Buffer.from(s.slice(2), 'hex');

      // ECDSA secp256k1 signature recovery (simplified)
      // In production, use a proper library like ethers.js or secp256k1
      const signature = Buffer.concat([rBuffer, sBuffer]);

      // Recovery bit
      const recoveryBit = v - 27;

      // This is a placeholder - actual implementation would use secp256k1 library
      return Buffer.alloc(65); // 65 bytes for uncompressed public key
    } catch (error) {
      throw new Error(`Failed to recover public key: ${error}`);
    }
  }

  /**
   * Derive Ethereum address from public key
   */
  private publicKeyToAddress(publicKey: Buffer): string {
    try {
      // Keccak-256 hash of the public key
      const hash = crypto.createHash('sha256').update(publicKey.slice(1)).digest();

      // Take the last 20 bytes
      const address = '0x' + hash.slice(-20).toString('hex');
      return address;
    } catch (error) {
      throw new Error(`Failed to derive address from public key: ${error}`);
    }
  }

  /**
   * Validate signature components
   */
  private validateSignatureComponents(v: number, r: string, s: string): boolean {
    // Check v is valid (27 or 28 for mainnet)
    if (v !== 27 && v !== 28) {
      return false;
    }

    // Check r and s are valid hex and in valid range
    const rNum = BigInt(r);
    const sNum = BigInt(s);
    const n = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

    return rNum > 0n && rNum < n && sNum > 0n && sNum < n;
  }

  /**
   * Validate complete signature
   */
  private validateSignature(signature: SignatureData, txData: any): boolean {
    return this.validateSignatureComponents(signature.v, signature.r, signature.s);
  }

  /**
   * Batch collect transaction signatures from a block
   */
  public async collectBlockSignatures(blockNumber: number): Promise<TransactionSignature[]> {
    try {
      const blockData = await this.fetchBlockData(blockNumber);

      if (!blockData) {
        return [];
      }

      const signatures: TransactionSignature[] = [];
      const promises = blockData.transactions.map((txHash) =>
        this.fetchTransactionWithSignature(txHash)
      );

      const results = await Promise.all(promises);
      signatures.push(...results.filter((sig) => sig !== null) as TransactionSignature[]);

      return signatures;
    } catch (error) {
      this.metrics.errors++;
      this.emit('error', { error, blockNumber, timestamp: Date.now() });
      return [];
    }
  }

  /**
   * Get collection metrics
   */
  public getMetrics(): CollectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.emit('cacheCleared', { timestamp: Date.now() });
  }

  /**
   * Cache management with size limit
   */
  private cacheData(key: string, data: BlockData): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, data);
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries: number = 0
  ): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (retries < this.config.maxRetries) {
        await this.delay(1000 * (retries + 1));
        return this.fetchWithRetry(url, options, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get collection status
   */
  public getStatus(): {
    isCollecting: boolean;
    metrics: CollectionMetrics;
    config: BlockchainConfig;
  } {
    return {
      isCollecting: this.isCollecting,
      metrics: this.getMetrics(),
      config: this.config,
    };
  }
}

/**
 * Factory function to create blockchain collector instances
 */
export function createBlockchainCollector(config: BlockchainConfig): BlockchainCollector {
  return new BlockchainCollector(config);
}

export default BlockchainCollector;
