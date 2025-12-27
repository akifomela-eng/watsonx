/**
 * Autonomous Blockchain Data Collector
 * Handles Bitcoin address discovery, transaction fetching, and signature extraction
 * Integrates with watsonx.ai for AI-powered prioritization
 * 
 * WARNING: Educational/Research Only
 * Recovering private keys without authorization is illegal and unethical
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import { decode as decodeDER } from 'asn1.js';

export interface BlockchainAddress {
  address: string;
  txCount: number;
  totalReceived: string;
  balance: string;
  firstSeen: string;
  lastActivity: string;
  transactionHashes?: string[];
}

export interface Transaction {
  txHash: string;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  timestamp: number;
}

export interface TransactionInput {
  previousOutput: string;
  scriptSig: string;
  signature?: string;
  publicKey?: string;
}

export interface TransactionOutput {
  value: string;
  scriptPubKey: string;
  address?: string;
}

export interface ECDSASignature {
  r: string;
  s: string;
  recoveryId?: number;
  nonce?: string;
  timestamp: number;
  txHash: string;
  address: string;
}

/**
 * BlockchainCollector - Autonomous data collection from blockchain
 * Uses multiple APIs for redundancy and accuracy
 */
export class BlockchainCollector extends EventEmitter {
  private blockchainInfoApi = 'https://blockchain.info';
  private blockchairApi = 'https://api.blockchair.com/bitcoin';
  private mempool = 'https://mempool.space/api';
  private addressCache: Map<string, BlockchainAddress> = new Map();
  private signatureCache: Map<string, ECDSASignature[]> = new Map();
  private requestDelay = 1000; // ms between requests to respect rate limits
  private lastRequestTime = 0;

  constructor() {
    super();
  }

  /**
   * Discover new Bitcoin addresses from recent blockchain activity
   * Scans multiple sources for comprehensive coverage
   */
  public async discoverNewAddresses(): Promise<BlockchainAddress[]> {
    try {
      const addresses: BlockchainAddress[] = [];

      // Method 1: Recent transactions from blockchain.info
      const recentTxs = await this.fetchRecentTransactions();
      for (const tx of recentTxs) {
        for (const output of tx.outputs) {
          if (output.address && !this.addressCache.has(output.address)) {
            const addressData = await this.fetchAddressData(output.address);
            if (addressData) {
              addresses.push(addressData);
              this.addressCache.set(output.address, addressData);
              this.emit('address-discovered', addressData);
            }
          }
        }
      }

      // Method 2: High-value addresses from Blockchair
      const highValueAddresses = await this.discoverHighValueAddresses();
      for (const addr of highValueAddresses) {
        if (!this.addressCache.has(addr.address)) {
          addresses.push(addr);
          this.addressCache.set(addr.address, addr);
          this.emit('address-discovered', addr);
        }
      }

      this.emit('discovery-complete', { count: addresses.length });
      return addresses;
    } catch (error) {
      this.emit('error', new Error(`Address discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      return [];
    }
  }

  /**
   * Fetch recent transactions from blockchain
   * @private
   */
  private async fetchRecentTransactions(): Promise<Transaction[]> {
    await this.respectRateLimit();

    try {
      const response = await axios.get(`${this.blockchainInfoApi}/blocks?format=json`);
      const transactions: Transaction[] = [];

      // Extract transactions from last 10 blocks
      for (const block of response.data.blocks.slice(0, 10)) {
        for (const tx of block.tx) {
          transactions.push(this.parseTransaction(tx));
        }
      }

      return transactions;
    } catch (error) {
      console.error('Failed to fetch recent transactions:', error);
      return [];
    }
  }

  /**
   * Fetch detailed data about a specific Bitcoin address
   * @param address - Bitcoin address to query
   */
  public async fetchAddressData(address: string): Promise<BlockchainAddress | null> {
    await this.respectRateLimit();

    try {
      const response = await axios.get(`${this.blockchainInfoApi}/address/${address}?format=json`);

      return {
        address: response.data.address,
        txCount: response.data.n_tx,
        totalReceived: response.data.total_received.toString(),
        balance: response.data.final_balance.toString(),
        firstSeen: new Date(response.data.txs[response.data.txs.length - 1].time * 1000).toISOString(),
        lastActivity: new Date(response.data.txs[0].time * 1000).toISOString(),
        transactionHashes: response.data.txs.map((tx: any) => tx.hash),
      };
    } catch (error) {
      console.error(`Failed to fetch address data for ${address}:`, error);
      return null;
    }
  }

  /**
   * Discover high-value addresses using Blockchair API
   * @private
   */
  private async discoverHighValueAddresses(): Promise<BlockchainAddress[]> {
    await this.respectRateLimit();

    try {
      const response = await axios.get(`${this.blockchairApi}/addresses?limit=100&sort=-balance`);
      return response.data.data.map((addr: any) => ({
        address: addr.address,
        txCount: addr.transaction_count,
        totalReceived: addr.received.toString(),
        balance: addr.balance.toString(),
        firstSeen: addr.first_seen_receiving,
        lastActivity: addr.last_seen_receiving,
      }));
    } catch (error) {
      console.error('Failed to discover high-value addresses:', error);
      return [];
    }
  }

  /**
   * Fetch all transactions for a given address
   * @param address - Bitcoin address
   */
  public async fetchAddressTransactions(address: string): Promise<Transaction[]> {
    await this.respectRateLimit();

    try {
      const response = await axios.get(`${this.blockchainInfoApi}/address/${address}?format=json`);
      return response.data.txs.map((tx: any) => this.parseTransaction(tx));
    } catch (error) {
      console.error(`Failed to fetch transactions for ${address}:`, error);
      return [];
    }
  }

  /**
   * Extract ECDSA signatures from transactions
   * Handles DER-encoded signatures, r/s values, and recovery IDs
   * @param address - Bitcoin address
   */
  public async extractSignatures(address: string): Promise<ECDSASignature[]> {
    if (this.signatureCache.has(address)) {
      return this.signatureCache.get(address) || [];
    }

    try {
      const transactions = await this.fetchAddressTransactions(address);
      const signatures: ECDSASignature[] = [];

      for (const tx of transactions) {
        for (const input of tx.inputs) {
          if (input.signature) {
            const parsedSig = this.parseSignature(input.signature);
            if (parsedSig) {
              signatures.push({
                ...parsedSig,
                timestamp: tx.timestamp,
                txHash: tx.txHash,
                address,
              });
            }
          }
        }
      }

      this.signatureCache.set(address, signatures);
      this.emit('signatures-extracted', { address, count: signatures.length });
      return signatures;
    } catch (error) {
      this.emit('error', new Error(`Signature extraction failed for ${address}: ${error instanceof Error ? error.message : 'Unknown error'}`));
      return [];
    }
  }

  /**
   * Parse DER-encoded ECDSA signature
   * Extracts r, s values and recovery ID
   * @private
   */
  private parseSignature(signatureHex: string): Partial<ECDSASignature> | null {
    try {
      // Remove recovery ID if present (last byte)
      let sigData = signatureHex;
      let recoveryId: number | undefined;

      if (signatureHex.length > 128) {
        recoveryId = parseInt(signatureHex.slice(-2), 16) & 0x03;
        sigData = signatureHex.slice(0, -2);
      }

      // Parse DER encoding
      // DER format: 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S]
      if (sigData.startsWith('30')) {
        const buffer = Buffer.from(sigData, 'hex');
        
        // Extract R
        const rLength = buffer[3];
        const r = buffer.slice(4, 4 + rLength).toString('hex');

        // Extract S
        const sStart = 4 + rLength + 2; // +2 for 0x02 and length
        const sLength = buffer[sStart - 1];
        const s = buffer.slice(sStart, sStart + sLength).toString('hex');

        // Calculate nonce hash (simplified)
        const nonce = Buffer.from(r, 'hex').toString('base64');

        return { r, s, recoveryId, nonce };
      }

      // Raw format (r || s)
      if (sigData.length === 128) {
        const r = sigData.slice(0, 64);
        const s = sigData.slice(64);
        return { r, s, recoveryId };
      }
    } catch (error) {
      console.error('Signature parsing error:', error);
    }

    return null;
  }

  /**
   * Parse a blockchain transaction
   * @private
   */
  private parseTransaction(txData: any): Transaction {
    return {
      txHash: txData.hash,
      inputs: txData.inputs.map((input: any) => ({
        previousOutput: `${input.previous_output.hash}:${input.previous_output.index}`,
        scriptSig: input.script,
        signature: this.extractSignatureFromScript(input.script),
        publicKey: this.extractPublicKeyFromScript(input.script),
      })),
      outputs: txData.out.map((output: any) => ({
        value: output.value.toString(),
        scriptPubKey: output.script,
        address: output.addr,
      })),
      timestamp: txData.time || Date.now() / 1000,
    };
  }

  /**
   * Extract signature from transaction script
   * @private
   */
  private extractSignatureFromScript(script: string): string | undefined {
    // Bitcoin script format: <signature> <pubkey>
    // Signatures are typically 70-72 bytes in DER format
    const match = script.match(/^[0-9a-f]{2}([0-9a-f]{140,144})/i);
    return match ? match[1] : undefined;
  }

  /**
   * Extract public key from transaction script
   * @private
   */
  private extractPublicKeyFromScript(script: string): string | undefined {
    // Typical script ends with public key (33 or 65 bytes)
    const match = script.match(/([0-9a-f]{66}|[0-9a-f]{130})$/i);
    return match ? match[1] : undefined;
  }

  /**
   * Discover high-value addresses with specific criteria
   * @private
   */
  private async discoverHighValueAddresses(): Promise<BlockchainAddress[]> {
    await this.respectRateLimit();

    try {
      const response = await axios.get(`${this.blockchairApi}/addresses?sort=-balance&limit=100`);
      return response.data.data.slice(0, 50).map((addr: any) => ({
        address: addr.address,
        txCount: addr.transaction_count,
        totalReceived: addr.received.toString(),
        balance: addr.balance.toString(),
        firstSeen: addr.first_seen_receiving || 'unknown',
        lastActivity: addr.last_seen_receiving || 'unknown',
      }));
    } catch (error) {
      console.error('Failed to discover high-value addresses:', error);
      return [];
    }
  }

  /**
   * Respect API rate limits
   * @private
   */
  private async respectRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Clear caches
   */
  public clearCaches(): void {
    this.addressCache.clear();
    this.signatureCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { addresses: number; signatures: number } {
    return {
      addresses: this.addressCache.size,
      signatures: Array.from(this.signatureCache.values()).reduce((sum, sigs) => sum + sigs.length, 0),
    };
  }
}

export default BlockchainCollector;