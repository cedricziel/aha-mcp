// Simple structured logging that's MCP transport aware
// Auto-instrumentation will handle the rest

import { ConfigService } from './config.js';

/**
 * Transport-aware logger that avoids stdout interference in stdio mode
 * Auto-instrumentation will automatically capture and correlate these logs
 */
export const log = {
  /**
   * Log an informational message
   */
  info: (message: string, attributes?: Record<string, any>) => {
    const config = ConfigService.getConfig();
    // Only log to stderr in stdio mode to avoid interfering with JSON-RPC protocol
    if (config.mode === 'stdio') {
      // In stdio mode, write to stderr to avoid protocol interference
      process.stderr.write(JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        transport: 'stdio',
        ...attributes
      }) + '\n');
    } else {
      console.log(JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        transport: 'sse',
        ...attributes
      }));
    }
  },

  /**
   * Log an error message
   */
  error: (message: string, error?: Error, attributes?: Record<string, any>) => {
    const config = ConfigService.getConfig();
    const logData = JSON.stringify({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      transport: config.mode,
      ...attributes,
      ...(error && {
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack
      })
    }) + '\n';

    // Always write errors to stderr regardless of transport mode
    process.stderr.write(logData);
  },

  /**
   * Log a warning message
   */
  warn: (message: string, attributes?: Record<string, any>) => {
    const config = ConfigService.getConfig();
    const logData = JSON.stringify({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      transport: config.mode,
      ...attributes
    }) + '\n';

    // Always write warnings to stderr to avoid protocol interference
    process.stderr.write(logData);
  },

  /**
   * Log a debug message
   */
  debug: (message: string, attributes?: Record<string, any>) => {
    const config = ConfigService.getConfig();
    // Only log debug messages in SSE mode or if explicitly enabled
    if (config.mode === 'sse' || process.env.DEBUG) {
      const logData = JSON.stringify({
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        transport: config.mode,
        ...attributes
      }) + '\n';

      process.stderr.write(logData);
    }
  }
};