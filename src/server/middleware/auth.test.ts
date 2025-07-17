import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Request, Response, NextFunction } from "express";
import { bearerAuth, isAuthEnabled } from "./auth.js";

// Mock express request and response
const mockRequest = (headers: Record<string, string> = {}): Request => ({
  headers,
} as Request);

const mockResponse = (): Response => {
  const res = {} as Response;
  res.status = mock(() => res);
  res.json = mock(() => res);
  return res;
};

const mockNext = (): NextFunction => mock(() => {});

describe("Bearer Authentication Middleware", () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.MCP_AUTH_TOKEN;
  });

  describe("bearerAuth", () => {
    it("should allow requests when no auth token is configured", () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      bearerAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 when auth token is configured but no Authorization header", () => {
      process.env.MCP_AUTH_TOKEN = "test-token";
      
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      bearerAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authorization header required",
        message: "Please provide a valid Bearer token in the Authorization header"
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header doesn't start with Bearer", () => {
      process.env.MCP_AUTH_TOKEN = "test-token";
      
      const req = mockRequest({ authorization: "Basic dGVzdDp0ZXN0" });
      const res = mockResponse();
      const next = mockNext();

      bearerAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid authorization format",
        message: "Authorization header must use Bearer token format: 'Bearer <token>'"
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when token is invalid", () => {
      process.env.MCP_AUTH_TOKEN = "test-token";
      
      const req = mockRequest({ authorization: "Bearer wrong-token" });
      const res = mockResponse();
      const next = mockNext();

      bearerAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid token",
        message: "The provided Bearer token is invalid"
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow requests when token is valid", () => {
      process.env.MCP_AUTH_TOKEN = "test-token";
      
      const req = mockRequest({ authorization: "Bearer test-token" });
      const res = mockResponse();
      const next = mockNext();

      bearerAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should handle case-sensitive token comparison", () => {
      process.env.MCP_AUTH_TOKEN = "Test-Token";
      
      const req = mockRequest({ authorization: "Bearer test-token" });
      const res = mockResponse();
      const next = mockNext();

      bearerAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("isAuthEnabled", () => {
    it("should return false when no auth token is configured", () => {
      expect(isAuthEnabled()).toBe(false);
    });

    it("should return true when auth token is configured in environment", () => {
      process.env.MCP_AUTH_TOKEN = "test-token";
      expect(isAuthEnabled()).toBe(true);
    });

    it("should return false when auth token is empty string", () => {
      process.env.MCP_AUTH_TOKEN = "";
      expect(isAuthEnabled()).toBe(false);
    });
  });
});