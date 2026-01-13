#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import startServer from "./server/server.js";
import { ConfigService } from "./core/config.js";
import { log } from "./core/logger.js";
import express from "express";
import cors from "cors";

// Parse command line arguments
function parseArgs(): { mode?: string; port?: number; host?: string } {
  const args = process.argv.slice(2);
  const result: { mode?: string; port?: number; host?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--mode':
        if (nextArg && ['stdio', 'sse', 'streamable-http'].includes(nextArg)) {
          result.mode = nextArg;
          i++; // Skip next argument
        } else {
          log.error('CLI argument error: --mode must be "stdio", "sse", or "streamable-http"');
          process.exit(1);
        }
        break;
      case '--port':
        if (nextArg) {
          const port = parseInt(nextArg, 10);
          if (isNaN(port) || port < 1 || port > 65535) {
            log.error('CLI argument error: --port must be a number between 1 and 65535');
            process.exit(1);
          }
          result.port = port;
          i++; // Skip next argument
        } else {
          log.error('CLI argument error: --port requires a value');
          process.exit(1);
        }
        break;
      case '--host':
        if (nextArg) {
          result.host = nextArg;
          i++; // Skip next argument
        } else {
          log.error('CLI argument error: --host requires a value');
          process.exit(1);
        }
        break;
      case '--help':
      case '-h':
        log.info('Displaying CLI help')
        console.log(`
Aha.io MCP Server

Usage: aha-mcp [options]

Options:
  --mode <mode>     Transport mode: stdio, sse, or streamable-http (default: from config)
  --port <port>     Port number for HTTP-based modes (default: 3001)
  --host <host>     Host address for HTTP-based modes (default: 0.0.0.0)
  --help, -h        Show this help message

Examples:
  aha-mcp                          # Use configuration settings
  aha-mcp --mode stdio             # Force stdio mode
  aha-mcp --mode streamable-http   # Force Streamable HTTP mode (recommended)
  aha-mcp --mode sse               # Force SSE mode (deprecated)
  aha-mcp --mode streamable-http --port 3000 --host localhost
        `);
        process.exit(0);
        break;
      default:
        log.error(`CLI argument error: Unknown argument "${arg}"`);
        process.exit(1);
    }
  }

  return result;
}

// Start stdio transport
async function startStdioTransport(server: any) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('MCP Server started successfully', { transport: 'stdio' });
}

// Start SSE transport
async function startSSETransport(server: any, port: number, host: string) {
  const app = express();
  app.use(express.json());
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    exposedHeaders: ['Content-Type', 'Access-Control-Allow-Origin']
  }));

  app.options('*', cors());

  // Keep track of active connections
  const connections = new Map<string, SSEServerTransport>();

  // SSE endpoint
  app.get("/sse", (req, res) => {
    log.warn('⚠️  SSE transport is deprecated and will be removed in a future version. Please migrate to Streamable HTTP transport. See: https://modelcontextprotocol.io/docs/concepts/transports');
    log.info('SSE connection request received', { client_ip: req.ip });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Deprecated', 'true');
    
    const sessionId = generateSessionId();
    log.info('Creating SSE session', { session_id: sessionId });
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    
    try {
      const transport = new SSEServerTransport("/messages", res);
      connections.set(sessionId, transport);
      
      req.on("close", () => {
        log.info('SSE connection closed', { session_id: sessionId });
        connections.delete(sessionId);
      });
      
      server.connect(transport).then(() => {
        log.info('SSE connection established successfully', { session_id: sessionId });
        res.write(`data: ${JSON.stringify({ type: "session_init", sessionId })}\n\n`);
      }).catch((error: Error) => {
        log.error('SSE connection error', error as Error, { session_id: sessionId });
        connections.delete(sessionId);
      });
    } catch (error) {
      log.error('SSE transport error', error as Error, { session_id: sessionId });
      connections.delete(sessionId);
      res.status(500).send(`Internal server error: ${error}`);
    }
  });

  // Messages endpoint
  app.post("/messages", (req, res) => {
    let sessionId = req.query.sessionId?.toString();

    if (!sessionId && connections.size === 1) {
      sessionId = Array.from(connections.keys())[0];
    }

    log.debug('Message received for SSE session', { session_id: sessionId });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Deprecated', 'true');
    
    if (!sessionId) {
      return res.status(400).json({ 
        error: "No session ID provided",
        activeConnections: connections.size
      });
    }
    
    const transport = connections.get(sessionId);
    if (!transport) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    try {
      transport.handlePostMessage(req, res).catch((error: Error) => {
        log.error('Message handling error', error as Error, { session_id: sessionId });
        res.status(500).json({ error: `Internal server error: ${error.message}` });
      });
    } catch (error) {
      log.error('Message handling exception', error as Error, { session_id: sessionId });
      res.status(500).json({ error: `Internal server error: ${error}` });
    }
  });

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      transport: "sse",
      activeConnections: connections.size,
      port,
      host
    });
  });

  // Info endpoint
  app.get("/", (req, res) => {
    res.json({
      name: "Aha.io MCP Server",
      transport: "sse",
      endpoints: {
        sse: "/sse",
        messages: "/messages",
        health: "/health"
      },
      activeConnections: connections.size
    });
  });

  // Start HTTP server
  const httpServer = app.listen(port, host, () => {
    log.info('MCP Server started successfully on SSE transport', {
      transport: 'sse',
      host,
      port,
      endpoints: {
        sse: `/sse`,
        messages: `/messages`,
        health: `/health`
      }
    });
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    log.info('Shutting down SSE server');
    connections.forEach((transport, sessionId) => {
      log.info('Closing SSE connection', { session_id: sessionId });
    });
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

// Generate session ID
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Validate Origin header for security (prevent DNS rebinding attacks)
function isAllowedOrigin(origin: string, host: string): boolean {
  try {
    const url = new URL(origin);
    // For localhost deployments, only allow localhost origins
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
    }
    // For other hosts, allow any origin (can be configured more restrictively)
    return true;
  } catch {
    // Invalid origin URL
    return false;
  }
}

// Start Streamable HTTP transport
async function startStreamableHTTPTransport(server: any, port: number, host: string) {
  const app = express();
  app.use(express.json());
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'MCP-Protocol-Version', 'Mcp-Session-Id'],
    credentials: true,
    exposedHeaders: ['Content-Type', 'MCP-Protocol-Version', 'Mcp-Session-Id', 'Access-Control-Allow-Origin']
  }));

  app.options('*', cors());

  // Create a single transport instance with session ID generation (stateful mode)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => generateSessionId()
  });

  // Connect the transport to the server
  await server.connect(transport);
  log.info('Streamable HTTP transport connected to server');

  // Unified /mcp endpoint - handles both POST and GET requests
  app.all("/mcp", async (req, res) => {
    const method = req.method;
    log.info('Streamable HTTP request received', { method, client_ip: req.ip });

    // Validate Origin for security
    const origin = req.headers['origin'];
    if (origin && !isAllowedOrigin(origin as string, host)) {
      log.warn('Forbidden origin', { origin });
      return res.status(403).json({ error: 'Forbidden origin' });
    }

    try {
      // Use handleRequest which handles both GET and POST
      await transport.handleRequest(req, res, method === 'POST' ? req.body : undefined);
      log.debug('Streamable HTTP request handled successfully', { method });
    } catch (error) {
      log.error('Streamable HTTP request error', error as Error, { method });
      if (!res.headersSent) {
        res.status(500).json({ error: `Internal server error: ${error}` });
      }
    }
  });

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      transport: "streamable-http",
      protocolVersion: "2025-06-18",
      port,
      host
    });
  });

  // Status endpoint
  app.get("/status", (req, res) => {
    res.json({
      name: "Aha.io MCP Server",
      transport: "streamable-http",
      protocolVersion: "2025-06-18",
      endpoints: {
        mcp: "/mcp (POST and GET)",
        health: "/health",
        status: "/status"
      },
      host,
      port
    });
  });

  // Info endpoint
  app.get("/", (req, res) => {
    res.json({
      name: "Aha.io MCP Server",
      transport: "streamable-http",
      protocolVersion: "2025-06-18",
      endpoints: {
        mcp: "/mcp",
        health: "/health",
        status: "/status"
      }
    });
  });

  // Start HTTP server
  const httpServer = app.listen(port, host, () => {
    log.info('MCP Server started successfully on Streamable HTTP transport', {
      transport: 'streamable-http',
      protocolVersion: '2025-06-18',
      host,
      port,
      endpoints: {
        mcp: `/mcp`,
        health: `/health`,
        status: `/status`
      }
    });
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    log.info('Shutting down Streamable HTTP server');
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

// Main function
async function main() {
  try {
    // Parse command line arguments
    const cliArgs = parseArgs();
    
    // Load configuration
    const config = ConfigService.getConfig();
    
    // Override config with CLI arguments
    const finalConfig = {
      ...config,
      ...(cliArgs.mode && { mode: cliArgs.mode as 'stdio' | 'sse' | 'streamable-http' }),
      ...(cliArgs.port && { port: cliArgs.port }),
      ...(cliArgs.host && { host: cliArgs.host })
    };

    log.info('Starting MCP server', { mode: finalConfig.mode, port: finalConfig.port, host: finalConfig.host });

    // Create server instance
    const server = await startServer();

    // Start appropriate transport
    if (finalConfig.mode === 'sse') {
      await startSSETransport(server, finalConfig.port || 3001, finalConfig.host || '0.0.0.0');
    } else if (finalConfig.mode === 'streamable-http') {
      await startStreamableHTTPTransport(server, finalConfig.port || 3001, finalConfig.host || '0.0.0.0');
    } else {
      await startStdioTransport(server);
    }
    
  } catch (error) {
    log.error('Error starting MCP server', error as Error);
    process.exit(1);
  }
}

main().catch((error) => {
  log.error('Fatal error in main()', error as Error);
  process.exit(1);
}); 