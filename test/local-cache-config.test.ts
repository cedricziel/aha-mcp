import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { homedir } from 'os';
import { join } from 'path';
import { isLocalCacheEnabled } from '../src/core/tools';
import { defaultDatabasePath } from '../src/core/database/database';

/**
 * Covers the two settings behind the "ENOENT: mkdir '/data'" failure reported from a
 * Claude Desktop install, and the decision to keep the local cache opt-in.
 */
describe('local cache configuration', () => {
  const saved = {
    enable: process.env.AHA_ENABLE_LOCAL_CACHE,
    dataDir: process.env.AHA_MCP_DATA_DIR,
    configDir: process.env.MCP_CONFIG_DIR
  };

  beforeEach(() => {
    delete process.env.AHA_ENABLE_LOCAL_CACHE;
    delete process.env.AHA_MCP_DATA_DIR;
    delete process.env.MCP_CONFIG_DIR;
  });

  afterEach(() => {
    for (const [key, value] of [
      ['AHA_ENABLE_LOCAL_CACHE', saved.enable],
      ['AHA_MCP_DATA_DIR', saved.dataDir],
      ['MCP_CONFIG_DIR', saved.configDir]
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  describe('isLocalCacheEnabled', () => {
    it('is off when the flag is unset', () => {
      expect(isLocalCacheEnabled()).toBe(false);
    });

    it.each(['true', 'TRUE', '1', 'yes', ' true '])('is on for %p', value => {
      process.env.AHA_ENABLE_LOCAL_CACHE = value;
      expect(isLocalCacheEnabled()).toBe(true);
    });

    it.each(['false', '0', 'no', '', 'maybe'])('stays off for %p', value => {
      process.env.AHA_ENABLE_LOCAL_CACHE = value;
      expect(isLocalCacheEnabled()).toBe(false);
    });
  });

  describe('defaultDatabasePath', () => {
    it('falls back to a writable directory under the home directory', () => {
      expect(defaultDatabasePath()).toBe(join(homedir(), '.aha-mcp', 'aha-mcp.db'));
    });

    it('does not depend on the working directory', () => {
      // The original bug: cwd was used as the base, so a desktop extension launched with
      // cwd '/' tried to create '/data' and every sync call failed with ENOENT.
      const original = process.cwd();
      try {
        process.chdir('/');
        expect(defaultDatabasePath()).not.toBe('/data/aha-mcp.db');
        expect(defaultDatabasePath()).toStartWith(homedir());
      } finally {
        process.chdir(original);
      }
    });

    it('honours AHA_MCP_DATA_DIR', () => {
      process.env.AHA_MCP_DATA_DIR = '/tmp/aha-cache';
      expect(defaultDatabasePath()).toBe(join('/tmp/aha-cache', 'aha-mcp.db'));
    });

    it('honours MCP_CONFIG_DIR, which the Docker image already sets', () => {
      process.env.MCP_CONFIG_DIR = '/home/mcp/.config';
      expect(defaultDatabasePath()).toBe(join('/home/mcp/.config', 'aha-mcp.db'));
    });

    it('prefers AHA_MCP_DATA_DIR over MCP_CONFIG_DIR', () => {
      process.env.AHA_MCP_DATA_DIR = '/tmp/explicit';
      process.env.MCP_CONFIG_DIR = '/home/mcp/.config';
      expect(defaultDatabasePath()).toBe(join('/tmp/explicit', 'aha-mcp.db'));
    });
  });
});
