#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import startServer from "./server/server.js";
import { ConfigService } from "./core/config.js";
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
        if (nextArg && ['stdio', 'sse'].includes(nextArg)) {
          result.mode = nextArg;
          i++; // Skip next argument
        } else {
          console.error('Error: --mode must be "stdio" or "sse"');
          process.exit(1);
        }
        break;
      case '--port':
        if (nextArg) {
          const port = parseInt(nextArg, 10);
          if (isNaN(port) || port < 1 || port > 65535) {
            console.error('Error: --port must be a number between 1 and 65535');
            process.exit(1);
          }
          result.port = port;
          i++; // Skip next argument
        } else {
          console.error('Error: --port requires a value');
          process.exit(1);
        }
        break;
      case '--host':
        if (nextArg) {
          result.host = nextArg;
          i++; // Skip next argument
        } else {
          console.error('Error: --host requires a value');
          process.exit(1);
        }
        break;
      case '--help':
      case '-h':
        console.log(`
Aha.io MCP Server

Usage: aha-mcp [options]

Options:
  --mode <mode>     Transport mode: stdio or sse (default: from config)
  --port <port>     Port number for SSE mode (default: 3001)
  --host <host>     Host address for SSE mode (default: 0.0.0.0)
  --help, -h        Show this help message

Examples:
  aha-mcp                    # Use configuration settings
  aha-mcp --mode stdio       # Force stdio mode
  aha-mcp --mode sse         # Force SSE mode
  aha-mcp --mode sse --port 3000 --host localhost
        `);
        process.exit(0);
        break;
      default:
        console.error(`Error: Unknown argument "${arg}"`);
        process.exit(1);
    }
  }

  return result;
}

// Start stdio transport
async function startStdioTransport(server: any) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("📡 MCP Server running on stdio transport");
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
    console.error(`📡 SSE connection request from ${req.ip}`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    const sessionId = generateSessionId();
    console.error(`🔗 Creating SSE session: ${sessionId}`);
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    
    try {
      const transport = new SSEServerTransport("/messages", res);
      connections.set(sessionId, transport);
      
      req.on("close", () => {
        console.error(`🔗 SSE connection closed: ${sessionId}`);
        connections.delete(sessionId);
      });
      
      server.connect(transport).then(() => {
        console.error(`✅ SSE connection established: ${sessionId}`);
        res.write(`data: ${JSON.stringify({ type: "session_init", sessionId })}\n\n`);
      }).catch((error: Error) => {
        console.error(`❌ SSE connection error: ${error}`);
        connections.delete(sessionId);
      });
    } catch (error) {
      console.error(`❌ SSE transport error: ${error}`);
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
    
    console.error(`📨 Message received for session: ${sessionId}`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
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
        console.error(`❌ Message handling error: ${error}`);
        res.status(500).json({ error: `Internal server error: ${error.message}` });
      });
    } catch (error) {
      console.error(`❌ Message handling exception: ${error}`);
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
    console.error(`🌐 MCP Server running on SSE transport at http://${host}:${port}`);
    console.error(`📡 SSE endpoint: http://${host}:${port}/sse`);
    console.error(`💬 Messages endpoint: http://${host}:${port}/messages`);
    console.error(`❤️  Health check: http://${host}:${port}/health`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.error('🛑 Shutting down SSE server...');
    connections.forEach((transport, sessionId) => {
      console.error(`🔗 Closing connection: ${sessionId}`);
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
      ...(cliArgs.mode && { mode: cliArgs.mode as 'stdio' | 'sse' }),
      ...(cliArgs.port && { port: cliArgs.port }),
      ...(cliArgs.host && { host: cliArgs.host })
    };

    console.error(`🔧 Starting server with mode: ${finalConfig.mode}`);
    
    // Create server instance
    const server = await startServer();
    
    // Start appropriate transport
    if (finalConfig.mode === 'sse') {
      await startSSETransport(server, finalConfig.port || 3001, finalConfig.host || '0.0.0.0');
    } else {
      await startStdioTransport(server);
    }
    
  } catch (error) {
    console.error("❌ Error starting MCP server:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("💥 Fatal error in main():", error);
  process.exit(1);
}); 