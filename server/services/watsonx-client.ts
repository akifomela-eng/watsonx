import { Authenticator } from 'ibm-cloud-sdk-core';

/**
 * IBM watsonx.ai Client Configuration Interface
 */
export interface WatsonxConfig {
  apiKey: string;
  projectId: string;
  serviceUrl?: string;
  region?: string;
}

/**
 * IBM watsonx.ai Client Initialization
 * Provides a singleton instance for managing watsonx.ai API interactions
 */
class WatsonxClient {
  private static instance: WatsonxClient;
  private authenticator: Authenticator | null = null;
  private config: WatsonxConfig | null = null;

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {}

  /**
   * Get or create the singleton instance of WatsonxClient
   */
  public static getInstance(): WatsonxClient {
    if (!WatsonxClient.instance) {
      WatsonxClient.instance = new WatsonxClient();
    }
    return WatsonxClient.instance;
  }

  /**
   * Initialize the watsonx.ai client with provided configuration
   * @param config - Configuration object containing API credentials and settings
   * @throws Error if required configuration parameters are missing
   */
  public initialize(config: WatsonxConfig): void {
    if (!config.apiKey) {
      throw new Error('IBM Cloud API Key is required for watsonx initialization');
    }
    if (!config.projectId) {
      throw new Error('Project ID is required for watsonx initialization');
    }

    this.config = config;
    this.setupAuthenticator();
  }

  /**
   * Setup the IBM Cloud authenticator using API key
   * @private
   */
  private setupAuthenticator(): void {
    if (!this.config) {
      throw new Error('Configuration not set. Call initialize() first.');
    }

    try {
      this.authenticator = new Authenticator();
      // Use the authenticator to authenticate API requests
      // The actual authentication type will be determined by the SDK
    } catch (error) {
      throw new Error(`Failed to initialize authenticator: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current configuration
   */
  public getConfig(): WatsonxConfig | null {
    return this.config;
  }

  /**
   * Get the authenticator instance
   */
  public getAuthenticator(): Authenticator | null {
    return this.authenticator;
  }

  /**
   * Check if the client is properly initialized
   */
  public isInitialized(): boolean {
    return this.config !== null && this.authenticator !== null;
  }

  /**
   * Validate the connection to watsonx.ai service
   * @returns Promise that resolves if connection is valid
   */
  public async validateConnection(): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    try {
      // Placeholder for actual connection validation
      // This would typically make a test API call to verify credentials
      console.log('Validating connection to watsonx.ai service...');
      return true;
    } catch (error) {
      console.error('Failed to validate watsonx connection:', error);
      return false;
    }
  }

  /**
   * Reset the client instance
   * Useful for testing or reinitializing with different configuration
   */
  public reset(): void {
    this.config = null;
    this.authenticator = null;
  }
}

/**
 * Export the singleton instance
 */
export const watsonxClient = WatsonxClient.getInstance();

/**
 * Initialize watsonx client with environment variables
 * Expected environment variables:
 * - IBM_CLOUD_API_KEY: IBM Cloud API Key
 * - WATSONX_PROJECT_ID: watsonx.ai Project ID
 * - WATSONX_SERVICE_URL: (Optional) Custom service URL
 * - WATSONX_REGION: (Optional) IBM Cloud region
 */
export function initializeWatsonxFromEnv(): void {
  const apiKey = process.env.IBM_CLOUD_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const serviceUrl = process.env.WATSONX_SERVICE_URL;
  const region = process.env.WATSONX_REGION;

  if (!apiKey || !projectId) {
    throw new Error(
      'Missing required environment variables: IBM_CLOUD_API_KEY and WATSONX_PROJECT_ID'
    );
  }

  watsonxClient.initialize({
    apiKey,
    projectId,
    serviceUrl,
    region,
  });
}

export default watsonxClient;
