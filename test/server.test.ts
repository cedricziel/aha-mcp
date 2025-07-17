import { describe, it, expect } from 'bun:test';
import startServer from '../src/server/server';

describe('MCP Server', () => {
  it('should create server without throwing', async () => {
    expect(async () => {
      await startServer();
    }).not.toThrow();
  });

  it('should return a server instance', async () => {
    const server = await startServer();
    expect(server).toBeDefined();
    expect(typeof server).toBe('object');
  });

  it('should have connect method', async () => {
    const server = await startServer();
    expect(server.connect).toBeDefined();
    expect(typeof server.connect).toBe('function');
  });
});