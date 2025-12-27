import axios from 'axios';
import { EventEmitter } from 'events';
import crypto from 'crypto';

/**
 * EDUCATIONAL/RESEARCH ONLY
 * Blockchain Address and Transaction Data Collection
 * This module is for security research and vulnerability analysis purposes only.
 * Unauthorized private key recovery is illegal and unethical.
 */

export interface BlockchainAddress {
  address: string;
  balance: number;
  totalReceived: number;
  totalSent: number;
  txCount: number;
  firstSeen: Date;
  lastActivity: Date;
  pubKey?: string;
  transactions: Transaction[];
}

export interface Transaction {
  txid: string;
  blockHeight: number;
  timestamp: Date;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  rawHex: string;
}

export interface TransactionInput {
  txid: string;
  vout: number;
  scriptSig: string;
  scriptPubKey?: string;
  address?: string;
  value?: number;
}

export interface TransactionOutput {
  value: number;
  scriptPubKey: string;
  address?: string;
}

/**
 * DER-Encoded ECDSA Signature with recovery metadata
 * Format: 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S]
 */
export interface ECDSASignature {
  r: bigint;
  s: bigint;
  recoveryId?: number;
  derEncoded: Buffer;
  rawHex: string;
  nonce?: bigint;
  messageHash: Buffer;
  timestamp: Date;
  txid: string;
}

/**
 * Autonomous Blockchain Data Collector
 * Discovers and collects Bitcoin transaction data for ECDSA vulnerability analysis
 */
export class BlockchainCollector extends EventEmitter {
  private blockchainApiUrl = 'https://blockchain.info/api';
  private blockchainCoreUrl = 'https://blockchair.com/bitcoin/api';
  private cache: Map<string, BlockchainAddress> = new Map();
  private collectedSignatures: ECDSASignature[] = [];
  private rateLimitDelay = 1000; // 1 second between API calls

  constructor() {
    super();
  }

  /**
   * Discover new Bitcoin addresses from recent blockchain activity
   * @param limit - Maximum number of blocks to scan
   * @returns Array of discovered addresses
   */
  public async discoverNewAddresses(limit: number = 10): Promise<BlockchainAddress[]> {
    try {
      console.log(`[*] Discovering new addresses from last ${limit} blocks...`);

      const addresses: BlockchainAddress[] = [];
      const blockHeights = await this.getRecentBlockHeights(limit);

      for (const height of blockHeights) {
        await this.sleep(this.rateLimitDelay);

        try {
          const blockAddresses = await this.extractAddressesFromBlock(height);
          addresses.push(...blockAddresses);

          this.emit('addresses-discovered', { count: blockAddresses.length, blockHeight: height });
        } catch (error) {
          console.error(`[!] Error extracting addresses from block ${height}:`, error);
        }
      }

      console.log(`[+] Discovered ${addresses.length} addresses`);
      return addresses;
    } catch (error) {
      console.error('[!] Error discovering new addresses:', error);
      throw error;
    }
  }

  /**
   * Fetch detailed blockchain data for a specific address
   * @param address - Bitcoin address to analyze
   * @returns Complete address data including transaction history
   */
  public async fetchAddressData(address: string): Promise<BlockchainAddress> {
    // Check cache first
    if (this.cache.has(address)) {
      return this.cache.get(address)!;
    }

    try {
      console.log(`[*] Fetching data for address: ${address}`);

      const response = await axios.get(
        `${this.blockchainApiUrl}/address/${address}?format=json&limit=500`,
        { timeout: 10000 }
      );

      const addressData: BlockchainAddress = {
        address,
        balance: response.data.final_balance / 1e8,
        totalReceived: response.data.total_received / 1e8,
        totalSent: response.data.total_sent / 1e8,
        txCount: response.data.n_tx,
        firstSeen: new Date(response.data.first_tx?.time * 1000 || Date.now()),
        lastActivity: new Date(response.data.latest_tx?.time * 1000 || Date.now()),
        transactions: [],
      };

      // Fetch all transactions for this address
      if (response.data.txs && response.data.txs.length > 0) {
        addressData.transactions = await this.parseTransactions(response.data.txs, address);
      }

      // Cache the result
      this.cache.set(address, addressData);
      this.emit('address-data-fetched', addressData);

      return addressData;
    } catch (error) {
      console.error(`[!] Error fetching address data for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Extract ECDSA signatures from transactions
   * Handles DER-encoded signatures with robust parsing
   * @param transactions - Array of transactions to parse
   * @returns Array of extracted ECDSA signatures
   */
  public async extractSignatures(transactions: Transaction[]): Promise<ECDSASignature[]> {
    const signatures: ECDSASignature[] = [];

    console.log(`[*] Extracting signatures from ${transactions.length} transactions...`);

    for (const tx of transactions) {
      try {
        for (const input of tx.inputs) {
          const scriptSig = input.scriptSig;

          if (!scriptSig || scriptSig.length < 144) {
            continue; // Skip if scriptSig is too short to contain a signature
          }

          // Extract DER-encoded signature and public key from scriptSig
          const extracted = this.parseDERSignature(scriptSig, tx.txid, tx.timestamp);

          if (extracted) {
            signatures.push(...extracted);
          }
        }
      } catch (error) {
        console.error(`[!] Error extracting signatures from tx ${tx.txid}:`, error);
      }
    }

    this.collectedSignatures.push(...signatures);
    console.log(`[+] Extracted ${signatures.length} signatures`);

    this.emit('signatures-extracted', signatures);
    return signatures;
  }

  /**
   * Parse DER-encoded ECDSA signatures
   * DER Format: 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S]
   * @private
   */
  private parseDERSignature(
    scriptSigHex: string,
    txid: string,
    timestamp: Date
  ): ECDSASignature[] | null {
    try {
      const signatures: ECDSASignature[] = [];
      const buffer = Buffer.from(scriptSigHex, 'hex');

      let offset = 0;

      while (offset < buffer.length) {
        // Look for DER signature markers
        if (buffer[offset] !== 0x30) {
          offset++;
          continue;
        }

        const totalLength = buffer[offset + 1];
        if (offset + totalLength + 2 > buffer.length) {
          break;
        }

        // Extract R
        if (buffer[offset + 2] !== 0x02) {
          offset++;
          continue;
        }

        const rLength = buffer[offset + 3];
        const rStart = offset + 4;
        const rBuffer = buffer.slice(rStart, rStart + rLength);
        const r = BigInt('0x' + rBuffer.toString('hex'));

        // Extract S
        const sOffset = rStart + rLength;
        if (sOffset + 2 >= buffer.length || buffer[sOffset] !== 0x02) {
          offset++;
          continue;
        }

        const sLength = buffer[sOffset + 1];
        const sStart = sOffset + 2;
        const sBuffer = buffer.slice(sStart, sStart + sLength);
        const s = BigInt('0x' + sBuffer.toString('hex'));

        // Create signature object
        const derBuffer = buffer.slice(offset, offset + totalLength + 2);

        signatures.push({
          r,
          s,
          recoveryId: undefined,
          derEncoded: derBuffer,
          rawHex: derBuffer.toString('hex'),
          messageHash: crypto.createHash('sha256').digest(),
          timestamp,
          txid,
        });

        offset += totalLength + 2;
      }

      return signatures.length > 0 ? signatures : null;
    } catch (error) {
      console.error('[!] Error parsing DER signature:', error);
      return null;
    }
  }

  /**
   * Get recent block heights for scanning
   * @private
   */
  private async getRecentBlockHeights(limit: number): Promise<number[]> {
    try {
      const response = await axios.get(`${this.blockchainApiUrl}/blocks?format=json`);
      return response.data.blocks.slice(0, limit).map((block: any) => block.height);
    } catch (error) {
      console.error('[!] Error fetching recent blocks:', error);
      return [];
    }
  }

  /**
   * Extract addresses from a specific block
   * @private
   */
  private async extractAddressesFromBlock(blockHeight: number): Promise<BlockchainAddress[]> {
    try {
      const response = await axios.get(`${this.blockchainApiUrl}/block-height/${blockHeight}?format=json&limit=500`);

      const addresses: BlockchainAddress[] = [];

      if (response.data.blocks && response.data.blocks[0]) {
        const block = response.data.blocks[0];

        for (const tx of block.tx || []) {
          for (const out of tx.out || []) {
            if (out.addr) {
              addresses.push({
                address: out.addr,
                balance: out.value / 1e8,
                totalReceived: 0,
                totalSent: 0,
                txCount: 0,
                firstSeen: new Date(block.time * 1000),
                lastActivity: new Date(block.time * 1000),
                transactions: [],
              });
            }
          }
        }
      }

      return addresses;
    } catch (error) {
      console.error(`[!] Error extracting addresses from block ${blockHeight}:`, error);
      return [];
    }
  }

  /**
   * Parse transactions from blockchain API response
   * @private
   */
  private async parseTransactions(txs: any[], address: string): Promise<Transaction[]> {
    return txs.map((tx) => ({
      txid: tx.hash,
      blockHeight: tx.block_height || 0,
      timestamp: new Date(tx.time * 1000),
      inputs: (tx.inputs || []).map((input: any) => ({
        txid: input.previous_output?.hash || '',
        vout: input.previous_output?.index || 0,
        scriptSig: input.script || '',
        address: input.previous_output?.addresses?.[0] || address,
        value: input.previous_output?.value || 0,
      })),
      outputs: (tx.out || []).map((output: any) => ({
        value: output.value / 1e8,
        scriptPubKey: output.script || '',
        address: output.addr || '',
      })),
      rawHex: tx.hash || '',
    }));
  }

  /**
   * Get collected signatures
   */
  public getCollectedSignatures(): ECDSASignature[] {
    return this.collectedSignatures;
  }

  /**
   * Clear signature cache
   */
  public clearSignatureCache(): void {
    this.collectedSignatures = [];
  }

  /**
   * Utility sleep function
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default BlockchainCollector;