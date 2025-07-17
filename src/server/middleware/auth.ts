import { Request, Response, NextFunction } from "express";
import { ConfigService } from "../../core/config.js";

/**
 * Bearer token authentication middleware for SSE mode
 * Validates Authorization header with Bearer token format
 */
export function bearerAuth(req: Request, res: Response, next: NextFunction) {
  const config = ConfigService.getConfig();
  const authToken = config.authToken || process.env.MCP_AUTH_TOKEN;
  
  // If no auth token is configured, allow all requests (backward compatibility)
  if (!authToken) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  // Check if Authorization header is present
  if (!authHeader) {
    return res.status(401).json({
      error: "Authorization header required",
      message: "Please provide a valid Bearer token in the Authorization header"
    });
  }
  
  // Check if it follows Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: "Invalid authorization format",
      message: "Authorization header must use Bearer token format: 'Bearer <token>'"
    });
  }
  
  // Extract token from header
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // Validate token
  if (token !== authToken) {
    return res.status(401).json({
      error: "Invalid token",
      message: "The provided Bearer token is invalid"
    });
  }
  
  // Token is valid, proceed to next middleware
  next();
}

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  const config = ConfigService.getConfig();
  return !!(config.authToken || process.env.MCP_AUTH_TOKEN);
}