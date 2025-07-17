import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import startServer, { performHealthCheck, serverStatus } from "./server.js";
import express, { Request, Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Environment variables - hardcoded values
const PORT = 3001;
const HOST = '0.0.0.0';

console.error(`Configured to listen on ${HOST}:${PORT}`);

// Setup Express
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Content-Type', 'Access-Control-Allow-Origin']
}));

// Add OPTIONS handling for preflight requests
app.options('*', cors());

// Keep track of active connections with session IDs
const connections = new Map<string, SSEServerTransport>();

// Initialize the server
let server: McpServer | null = null;
startServer().then(s => {
  server = s;
  console.error("MCP Server initialized successfully");
}).catch(error => {
  console.error("Failed to initialize server:", error);
  process.exit(1);
});

// Define routes
// @ts-ignore
app.get("/sse", (req: Request, res: Response) => {
  console.error(`Received SSE connection request from ${req.ip}`);
  console.error(`Query parameters: ${JSON.stringify(req.query)}`);
  
  // Set CORS headers explicitly
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (!server) {
    console.error("Server not initialized yet, rejecting SSE connection");
    return res.status(503).send("Server not initialized");
  }
  
  // Generate a unique session ID if one is not provided
  // The sessionId is crucial for mapping SSE connections to message handlers
  const sessionId = generateSessionId();
  console.error(`Creating SSE session with ID: ${sessionId}`);
  
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  
  // Create transport - handle before writing to response
  try {
    console.error(`Creating SSE transport for session: ${sessionId}`);
    
    // Create and store the transport keyed by session ID
    // Note: The path must match what the client expects (typically "/messages")
    const transport = new SSEServerTransport("/messages", res);
    connections.set(sessionId, transport);
    
    // Handle connection close
    req.on("close", () => {
      console.error(`SSE connection closed for session: ${sessionId}`);
      connections.delete(sessionId);
    });
    
    // Connect transport to server - this must happen before sending any data
    server.connect(transport).then(() => {
      // Send an initial event with the session ID for the client to use in messages
      // Only send this after the connection is established
      console.error(`SSE connection established for session: ${sessionId}`);
      
      // Send the session ID to the client
      res.write(`data: ${JSON.stringify({ type: "session_init", sessionId })}\n\n`);
    }).catch((error: Error) => {
      console.error(`Error connecting transport to server: ${error}`);
      connections.delete(sessionId);
    });
  } catch (error) {
    console.error(`Error creating SSE transport: ${error}`);
    connections.delete(sessionId);
    res.status(500).send(`Internal server error: ${error}`);
  }
});

// @ts-ignore
app.post("/messages", (req: Request, res: Response) => {
  // Extract the session ID from the URL query parameters
  let sessionId = req.query.sessionId?.toString();
  
  // If no sessionId is provided and there's only one connection, use that
  if (!sessionId && connections.size === 1) {
    sessionId = Array.from(connections.keys())[0];
    console.error(`No sessionId provided, using the only active session: ${sessionId}`);
  }
  
  console.error(`Received message for sessionId ${sessionId}`);
  console.error(`Message body: ${JSON.stringify(req.body)}`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (!server) {
    console.error("Server not initialized yet");
    return res.status(503).json({ error: "Server not initialized" });
  }
  
  if (!sessionId) {
    console.error("No session ID provided and multiple connections exist");
    return res.status(400).json({ 
      error: "No session ID provided. Please provide a sessionId query parameter or connect to /sse first.",
      activeConnections: connections.size
    });
  }
  
  const transport = connections.get(sessionId);
  if (!transport) {
    console.error(`Session not found: ${sessionId}`);
    return res.status(404).json({ error: "Session not found" });
  }
  
  console.error(`Handling message for session: ${sessionId}`);
  try {
    transport.handlePostMessage(req, res).catch((error: Error) => {
      console.error(`Error handling post message: ${error}`);
      res.status(500).json({ error: `Internal server error: ${error.message}` });
    });
  } catch (error) {
    console.error(`Exception handling post message: ${error}`);
    res.status(500).json({ error: `Internal server error: ${error}` });
  }
});

// Add comprehensive health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  try {
    if (!server) {
      return res.status(503).json({
        status: "unavailable",
        message: "Server not initialized",
        timestamp: new Date().toISOString()
      });
    }

    const healthCheck = await performHealthCheck();
    const httpStatus = healthCheck.status === "healthy" ? 200 : 
                      healthCheck.status === "degraded" ? 200 : 503;
    
    res.status(httpStatus).json({
      ...healthCheck,
      http: {
        activeConnections: connections.size,
        connectedSessionIds: Array.from(connections.keys()),
        port: PORT,
        host: HOST
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Add detailed status endpoint
app.get("/status", (req: Request, res: Response) => {
  res.status(200).json({
    ...serverStatus,
    http: {
      activeConnections: connections.size,
      connectedSessionIds: Array.from(connections.keys()),
      port: PORT,
      host: HOST
    },
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      workingDirectory: process.cwd(),
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      }
    }
  });
});

// Add a root endpoint for basic info
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    name: "Aha.io MCP Server",
    version: serverStatus.version,
    endpoints: {
      sse: "/sse",
      messages: "/messages",
      health: "/health",
      status: "/status"
    },
    status: server ? "ready" : "initializing",
    activeConnections: connections.size,
    capabilities: {
      tools: "41 Aha.io integration tools (including health checks & configuration)",
      resources: "40+ Aha.io entity resources",
      prompts: "12 domain-specific workflow prompts",
      features: [
        "Context-aware prompts",
        "Dual transport (stdio/HTTP)",
        "Full CRUD operations",
        "Health monitoring",
        "Server diagnostics",
        "Runtime configuration"
      ]
    }
  });
});

// Helper function to generate a UUID-like session ID
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.error('Shutting down server...');
  connections.forEach((transport, sessionId) => {
    console.error(`Closing connection for session: ${sessionId}`);
  });
  process.exit(0);
});

// Start the HTTP server on a different port (3001) to avoid conflicts
const httpServer = app.listen(PORT, HOST, () => {
  console.error(`🌐 Aha.io MCP Server HTTP transport running at http://${HOST}:${PORT}`);
  console.error(`📡 SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.error(`💬 Messages endpoint: http://${HOST}:${PORT}/messages`);
  console.error(`❤️  Health check: http://${HOST}:${PORT}/health`);
  console.error(`📊 Status endpoint: http://${HOST}:${PORT}/status`);
}).on('error', (err: Error) => {
  console.error(`Server error: ${err}`);
}); 