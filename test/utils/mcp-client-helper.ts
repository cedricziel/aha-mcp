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

/** Thrown when a server subprocess failed to serve, so callers can retry on a new port. */
class ServerStartupError extends Error {}

/**
 * Every server subprocess this helper spawns, so none can outlive the test run.
 *
 * Without this, an interrupted or crashing run left servers running indefinitely: a machine
 * accumulated 22 of them, which slowed things down enough to cause the very readiness
 * timeouts that leaked the next one.
 */
const liveServers = new Set<Subprocess>();
let exitHookInstalled = false;

function trackServer(proc: Subprocess): void {
  liveServers.add(proc);
  if (exitHookInstalled) return;
  exitHookInstalled = true;

  // Synchronous, because exit handlers cannot await.
  const killAll = () => {
    for (const p of liveServers) {
      try {
        p.kill();
      } catch {
        // Already gone.
      }
    }
    liveServers.clear();
  };
  process.on('exit', killAll);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      killAll();
      process.exit(130);
    });
  }
}

function untrackServer(proc: Subprocess): void {
  liveServers.delete(proc);
}

export interface TestClientOptions {
  company?: string;
  token?: string;
  timeout?: number;
  mode?: 'stdio' | 'streamable-http';
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
    // Run the source directly with bun, so tests do not depend on a prior build.
    this.serverCommand = join(__dirname, '../..', 'src/index.ts');
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
   * Wait for HTTP server to be ready.
   *
   * Polls /health, but gives up immediately if the subprocess has already exited - most
   * often because the port was taken between findAvailablePort() closing its probe socket
   * and the child binding it. Waiting out the full timeout in that case turned a startup
   * failure into an opaque "did not become ready" after 15-30 seconds.
   */
  private async waitForHttpServer(port: number, timeout: number): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.serverProcess?.exitCode !== null && this.serverProcess?.exitCode !== undefined) {
        throw new ServerStartupError(
          `Server exited with code ${this.serverProcess.exitCode} before becoming ready on ` +
            `port ${port}.${await this.readServerStderr()}`
        );
      }

      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) return;
      } catch {
        // Not listening yet.
      }

      // Sleep on every iteration. Previously only the catch branch slept, so a server
      // answering /health with a non-2xx status produced a tight request loop.
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Kill before reading stderr; see readServerStderr().
    this.serverProcess?.kill();

    // ServerStartupError, not Error, so connect() retries this on a fresh port and a fresh
    // subprocess. A cold start takes about a second unloaded, so a budget in the seconds is
    // already generous - when it is exceeded on CI the spawn has been starved, not slowed,
    // and another attempt beats waiting longer on a process that is already losing.
    throw new ServerStartupError(
      `Server did not become ready on port ${port} within ${timeout}ms.${await this.readServerStderr()}`
    );
  }

  /**
   * Best-effort stderr capture, to make startup failures diagnosable.
   *
   * Only safe once the child has exited: reading the stream to EOF while it is still running
   * never returns, because stderr stays open. Callers must kill the process first.
   */
  private async readServerStderr(): Promise<string> {
    const proc = this.serverProcess;
    const stderr = proc?.stderr;
    if (!proc || !stderr || typeof stderr === 'number') return '';
    if (proc.exitCode === null && proc.signalCode === null) return '';

    try {
      // Still bounded, in case the stream stays open for another reason.
      const text = await Promise.race([
        new Response(stderr as ReadableStream).text(),
        new Promise<string>(resolve => setTimeout(() => resolve(''), 1000))
      ]);
      return text.trim() ? `\nServer stderr:\n${text.trim().slice(0, 2000)}` : '';
    } catch {
      return '';
    }
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
      // findAvailablePort() closes its probe socket before the child binds, so the port can
      // be taken in between - especially with several test files running at once. Retry on a
      // fresh port rather than reporting a timeout for what is a lost race.
      const attempts = options.port ? 1 : 3;

      // `timeout` is the budget for becoming ready in total, not per attempt, so retrying
      // does not push a test past its own bun timeout. Three 5s attempts fit where one 15s
      // wait did, and each one is still five times the ~1s a cold start actually needs.
      // No floor: a caller that passes a deliberately tiny budget wants a fast failure, and
      // clamping it upwards let a server actually start when the test needed it not to.
      const readinessTimeout = Math.floor(timeout / attempts);

      for (let attempt = 1; ; attempt++) {
        this.httpPort = options.port || (await this.findAvailablePort());
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
        trackServer(this.serverProcess);

        try {
          await this.waitForHttpServer(this.httpPort, readinessTimeout);
          break;
        } catch (error) {
          untrackServer(this.serverProcess);
          this.serverProcess?.kill();
          this.serverProcess = undefined;
          if (attempt >= attempts || !(error instanceof ServerStartupError)) throw error;
        }
      }

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
    // Clean up even when the client never finished connecting. A failed connect() still
    // leaves a spawned subprocess behind, and withTestClient's finally block relies on this
    // call to reap it - returning early here leaked a server on every readiness timeout,
    // and each orphan then slowed the machine down enough to cause the next one.
    if (!this.connected && !this.serverProcess && !this.transport && !this.client) {
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
   * The server's instructions, as returned in the initialize response.
   */
  getInstructions(): string | undefined {
    this.ensureConnected();
    return this.client!.getInstructions();
  }

  /**
   * Complete a prompt argument, returning the offered values.
   */
  async complete(promptName: string, argumentName: string, value: string): Promise<string[]> {
    this.ensureConnected();

    try {
      const response = await this.client!.complete({
        ref: { type: 'ref/prompt', name: promptName },
        argument: { name: argumentName, value }
      });
      return response.completion.values;
    } catch (error) {
      console.error(`Error completing ${promptName}.${argumentName}:`, error);
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
   * Call a tool without an `arguments` member at all, which CallToolRequest permits for
   * tools that take no parameters. `callTool` above always sends one, so it cannot cover
   * this case.
   */
  async callToolWithoutArguments(name: string): Promise<any> {
    this.ensureConnected();

    return this.client!.callTool({ name });
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
      untrackServer(this.serverProcess);
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
