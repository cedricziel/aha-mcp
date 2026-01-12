import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TestClientOptions {
  company?: string;
  token?: string;
  timeout?: number;
  mode?: 'stdio' | 'sse';
}

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceContents {
  uri: string;
  text?: string;
  blob?: string;
  mimeType?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  };
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
}

/**
 * Test wrapper for MCP Client with automatic process management
 */
export class TestMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;
  private serverCommand: string;

  constructor() {
    // Find the built server or use the source directly with bun
    const projectRoot = join(__dirname, '../..');
    const builtServer = join(projectRoot, 'build/index.js');
    const sourceServer = join(projectRoot, 'src/index.ts');

    // For tests, we'll use bun to run the source directly
    this.serverCommand = sourceServer;
  }

  /**
   * Connect to the MCP server
   */
  async connect(options: TestClientOptions = {}): Promise<void> {
    if (this.connected) {
      throw new Error('Client already connected');
    }

    const {
      company = 'test-company',
      token = 'test-token',
      timeout = 10000,
      mode = 'stdio'
    } = options;

    // Create client
    this.client = new Client(
      {
        name: 'test-mcp-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    // Create transport
    this.transport = new StdioClientTransport({
      command: 'bun',
      args: ['run', this.serverCommand, '--mode', mode],
      env: {
        ...process.env,
        AHA_COMPANY: company,
        AHA_TOKEN: token,
        NODE_ENV: 'test'
      },
      stderr: 'pipe' // Capture stderr for debugging
    });

    // Set up error handling
    this.transport.onerror = (error: Error) => {
      console.error('Transport error:', error);
    };

    // Connect with timeout
    const connectPromise = this.client.connect(this.transport);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), timeout)
    );

    try {
      await Promise.race([connectPromise, timeoutPromise]);
      this.connected = true;
    } catch (error) {
      // Cleanup on error
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.cleanup();
  }

  /**
   * List all available resources
   */
  async listResources(): Promise<Resource[]> {
    this.ensureConnected();

    try {
      const response = await this.client!.listResources();
      return response.resources as Resource[];
    } catch (error) {
      console.error('Error listing resources:', error);
      throw error;
    }
  }

  /**
   * Read a specific resource by URI
   */
  async readResource(uri: string): Promise<ResourceContents[]> {
    this.ensureConnected();

    try {
      const response = await this.client!.readResource({ uri });
      return response.contents as ResourceContents[];
    } catch (error) {
      console.error(`Error reading resource ${uri}:`, error);
      throw error;
    }
  }

  /**
   * List all available prompts
   */
  async listPrompts(): Promise<any[]> {
    this.ensureConnected();

    try {
      const response = await this.client!.listPrompts();
      return response.prompts;
    } catch (error) {
      console.error('Error listing prompts:', error);
      throw error;
    }
  }

  /**
   * Get a specific prompt
   */
  async getPrompt(name: string, args: Record<string, any> = {}): Promise<Message[]> {
    this.ensureConnected();

    try {
      const response = await this.client!.getPrompt({ name, arguments: args });
      return response.messages as Message[];
    } catch (error) {
      console.error(`Error getting prompt ${name}:`, error);
      throw error;
    }
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<Tool[]> {
    this.ensureConnected();

    try {
      const response = await this.client!.listTools();
      return response.tools as Tool[];
    } catch (error) {
      console.error('Error listing tools:', error);
      throw error;
    }
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    this.ensureConnected();

    try {
      const response = await this.client!.callTool({ name, arguments: args });
      return response;
    } catch (error) {
      console.error(`Error calling tool ${name}:`, error);
      throw error;
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get server capabilities
   */
  getServerCapabilities(): any {
    return this.client?.getServerCapabilities();
  }

  /**
   * Get server version info
   */
  getServerVersion(): any {
    return this.client?.getServerVersion();
  }

  /**
   * Ensure client is connected, throw if not
   */
  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error('Client not connected. Call connect() first.');
    }
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    this.connected = false;

    try {
      if (this.transport) {
        await this.transport.close();
      }
    } catch (error) {
      console.warn('Error closing transport:', error);
    }

    this.client = null;
    this.transport = null;
  }
}

/**
 * Helper function to run a test with automatic client setup and teardown
 */
export async function withTestClient<T>(
  fn: (client: TestMCPClient) => Promise<T>,
  options?: TestClientOptions
): Promise<T> {
  const client = new TestMCPClient();

  try {
    await client.connect(options);
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}
