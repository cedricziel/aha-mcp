// Simple structured logging using console with JSON format
// Auto-instrumentation will handle the rest

/**
 * Simple structured logger using JSON console output
 * Auto-instrumentation will automatically capture and correlate these logs
 */
export const log = {
  /**
   * Log an informational message
   */
  info: (message: string, attributes?: Record<string, any>) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...attributes
    }));
  },

  /**
   * Log an error message
   */
  error: (message: string, error?: Error, attributes?: Record<string, any>) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      ...attributes,
      ...(error && {
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack
      })
    }));
  },

  /**
   * Log a warning message
   */
  warn: (message: string, attributes?: Record<string, any>) => {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...attributes
    }));
  },

  /**
   * Log a debug message
   */
  debug: (message: string, attributes?: Record<string, any>) => {
    console.debug(JSON.stringify({
      level: 'debug',
      message,
      timestamp: new Date().toISOString(),
      ...attributes
    }));
  }
};