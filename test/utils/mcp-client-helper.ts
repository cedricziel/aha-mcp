import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'net';
import type { AddressInfo } from 'net';
import type { Subprocess } from 'bun';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TestClientOptions {
  company?: string;
  token?: string;
  timeout?: number;
  mode?: 'stdio' | 'sse' | 'streamable-http';
  port?: number;
  host?: string;
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
  private transport: StdioClientTransport | StreamableHTTPClientTransport | null = null;
  private connected: boolean = false;
  private serverCommand: string;
  private httpPort?: number;
  private httpBaseUrl?: string;
  private serverProcess?: Subprocess;

  constructor() {
    // Find the built server or use the source directly with bun
    const projectRoot = join(__dirname, '../..');
    const builtServer = join(projectRoot, 'build/index.js');
    const sourceServer = join(projectRoot, 'src/index.ts');

    // For tests, we'll use bun to run the source directly
    this.serverCommand = sourceServer;
  }

  /**
   * Find an available port for HTTP server
   */
  private async findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        server.close(() => resolve(port));
      });
      server.on('error', reject);
    });
  }

  /**
   * Wait for HTTP server to be ready
   */
  private async waitForHttpServer(port: number, timeout: number): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    throw new Error(`Server did not become ready on port ${port} within ${timeout}ms`);
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
      timeout = 30000, // Increased default timeout for CI environments
      mode = 'stdio',
      host = 'localhost'
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

    if (mode === 'streamable-http') {
      // Find available port
      this.httpPort = options.port || await this.findAvailablePort();
      this.httpBaseUrl = `http://${host}:${this.httpPort}`;

      // Spawn server with HTTP mode
      this.serverProcess = Bun.spawn([
        'bun', 'run', this.serverCommand,
        '--mode', 'streamable-http',
        '--port', this.httpPort.toString(),
        '--host', host
      ], {
        env: {
          ...process.env,
          AHA_COMPANY: company,
          AHA_TOKEN: token,
          NODE_ENV: 'test'
        },
        stderr: 'pipe'
      });

      // Wait for server to be ready
      await this.waitForHttpServer(this.httpPort, timeout);

      // Create HTTP transport
      this.transport = new StreamableHTTPClientTransport(
        new URL(`${this.httpBaseUrl}/mcp`)
      );

      // Connect client
      try {
        await this.client.connect(this.transport);
        this.connected = true;
      } catch (error) {
        await this.cleanup();
        throw error;
      }
    } else {
      // Create stdio transport
      this.transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', this.serverCommand, '--mode', mode],
        env: {
          ...process.env,
          AHA_COMPANY: company,
          AHA_TOKEN: token,
          NODE_ENV: 'test'
        },
        stderr: 'pipe'
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

    // Kill HTTP server process if it exists
    if (this.serverProcess) {
      try {
        this.serverProcess.kill();
      } catch (error) {
        console.warn('Error killing server process:', error);
      }
      this.serverProcess = undefined;
    }

    // Clear HTTP state
    if (this.httpPort) {
      this.httpPort = undefined;
      this.httpBaseUrl = undefined;
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
