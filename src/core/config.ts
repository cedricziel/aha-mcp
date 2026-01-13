import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type TransportMode = 'stdio' | 'sse' | 'streamable-http';

export interface ServerConfig {
  company: string | null;
  token: string | null;
  mode: TransportMode;
  port?: number;
  host?: string;
  authToken?: string | null;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Configuration management service for Aha.io MCP Server
 */
export class ConfigService {
  private static readonly CONFIG_FILE = join(homedir(), '.aha-mcp-config.json');
  private static readonly DEFAULT_CONFIG: ServerConfig = {
    company: null,
    token: null,
    mode: 'stdio',
    port: 3001,
    host: '0.0.0.0',
    authToken: null
  };

  private static currentConfig: ServerConfig | null = null;

  /**
   * Load configuration from environment variables, config file, or defaults
   * Priority: ENV vars → config file → defaults
   */
  public static loadConfig(): ServerConfig {
    if (this.currentConfig) {
      return this.currentConfig;
    }

    // Start with defaults
    let config: ServerConfig = { ...this.DEFAULT_CONFIG };

    // Override with config file if it exists
    if (existsSync(this.CONFIG_FILE)) {
      try {
        const fileContent = readFileSync(this.CONFIG_FILE, 'utf8');
        const fileConfig = JSON.parse(fileContent);
        config = { ...config, ...fileConfig };
      } catch (error) {
        console.error('Warning: Failed to parse config file, using defaults:', error);
      }
    }

    // Override with environment variables
    if (process.env.AHA_COMPANY) {
      config.company = process.env.AHA_COMPANY;
    }
    if (process.env.AHA_TOKEN) {
      config.token = process.env.AHA_TOKEN;
    }
    if (process.env.MCP_TRANSPORT_MODE) {
      const mode = process.env.MCP_TRANSPORT_MODE.toLowerCase();
      if (mode === 'stdio' || mode === 'sse' || mode === 'streamable-http') {
        config.mode = mode as TransportMode;
      }
    }
    if (process.env.MCP_PORT) {
      const port = parseInt(process.env.MCP_PORT, 10);
      if (!isNaN(port) && port > 0 && port <= 65535) {
        config.port = port;
      }
    }
    if (process.env.MCP_HOST) {
      config.host = process.env.MCP_HOST;
    }
    if (process.env.MCP_AUTH_TOKEN) {
      config.authToken = process.env.MCP_AUTH_TOKEN;
    }

    this.currentConfig = config;
    return config;
  }

  /**
   * Save configuration to file
   */
  public static saveConfig(config: ServerConfig): void {
    try {
      // Don't save sensitive tokens in plain text - use simple obfuscation
      const configToSave = {
        ...config,
        token: config.token ? this.obfuscateToken(config.token) : null,
        authToken: config.authToken ? this.obfuscateToken(config.authToken) : null
      };

      writeFileSync(this.CONFIG_FILE, JSON.stringify(configToSave, null, 2));
      
      // Update current config with original (non-obfuscated) token
      this.currentConfig = config;
    } catch (error) {
      console.error('Failed to save config file:', error);
      throw new Error('Failed to save configuration');
    }
  }

  /**
   * Update configuration at runtime
   */
  public static updateConfig(updates: Partial<ServerConfig>): ServerConfig {
    const currentConfig = this.loadConfig();
    const newConfig = { ...currentConfig, ...updates };
    
    // Validate the new configuration
    const validation = this.validateConfig(newConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Save and apply the new configuration
    this.saveConfig(newConfig);
    return newConfig;
  }

  /**
   * Get current configuration
   */
  public static getConfig(): ServerConfig {
    return this.loadConfig();
  }

  /**
   * Validate configuration
   */
  public static validateConfig(config: ServerConfig): ConfigValidationResult {
    const errors: string[] = [];

    // Validate company (subdomain)
    if (config.company) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/.test(config.company)) {
        errors.push('Company must be a valid subdomain (alphanumeric and hyphens only)');
      }
    }

    // Validate token format (basic check)
    if (config.token) {
      if (config.token.length < 10) {
        errors.push('Token appears to be too short');
      }
      if (!/^[A-Za-z0-9._-]+$/.test(config.token)) {
        errors.push('Token contains invalid characters');
      }
    }

    // Validate auth token format (basic check)
    if (config.authToken) {
      if (config.authToken.length < 8) {
        errors.push('Auth token appears to be too short (minimum 8 characters)');
      }
      if (!/^[A-Za-z0-9._-]+$/.test(config.authToken)) {
        errors.push('Auth token contains invalid characters');
      }
    }

    // Validate transport mode
    if (!['stdio', 'sse', 'streamable-http'].includes(config.mode)) {
      errors.push('Mode must be either "stdio", "sse", or "streamable-http"');
    }

    // Validate port for HTTP-based modes (SSE and Streamable HTTP)
    if (config.mode === 'sse' || config.mode === 'streamable-http') {
      if (!config.port || config.port < 1 || config.port > 65535) {
        errors.push('Port must be between 1 and 65535 for HTTP-based transports');
      }
    }

    // Validate host for HTTP-based modes (SSE and Streamable HTTP)
    if (config.mode === 'sse' || config.mode === 'streamable-http') {
      if (!config.host || config.host.trim() === '') {
        errors.push('Host must be specified for HTTP-based transports');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if configuration is complete for operation
   */
  public static isConfigComplete(config: ServerConfig): boolean {
    return !!(config.company && config.token);
  }

  /**
   * Reset configuration to defaults
   */
  public static resetConfig(): ServerConfig {
    const defaultConfig = { ...this.DEFAULT_CONFIG };
    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Get configuration summary (without sensitive information)
   */
  public static getConfigSummary(): object {
    const config = this.loadConfig();
    return {
      company: config.company || 'not configured',
      tokenConfigured: !!config.token,
      authTokenConfigured: !!config.authToken,
      mode: config.mode,
      port: config.port,
      host: config.host,
      configFile: this.CONFIG_FILE,
      isComplete: this.isConfigComplete(config)
    };
  }

  /**
   * Simple token obfuscation (not cryptographically secure, just for storage)
   */
  private static obfuscateToken(token: string): string {
    // Simple base64 encoding - not secure but better than plain text
    return Buffer.from(token).toString('base64');
  }

  /**
   * De-obfuscate token
   */
  private static deobfuscateToken(obfuscatedToken: string): string {
    try {
      return Buffer.from(obfuscatedToken, 'base64').toString('utf8');
    } catch (error) {
      console.error('Failed to deobfuscate token:', error);
      return obfuscatedToken; // Return as-is if deobfuscation fails
    }
  }

  /**
   * Load configuration with deobfuscated token
   */
  private static loadConfigWithDeobfuscation(): ServerConfig {
    const config = this.loadConfig();
    
    // If tokens are obfuscated in config file, deobfuscate them
    if (this.currentConfig === null && existsSync(this.CONFIG_FILE)) {
      try {
        const fileContent = readFileSync(this.CONFIG_FILE, 'utf8');
        const fileConfig = JSON.parse(fileContent);
        if (fileConfig.token && config.token) {
          config.token = this.deobfuscateToken(fileConfig.token);
        }
        if (fileConfig.authToken && config.authToken) {
          config.authToken = this.deobfuscateToken(fileConfig.authToken);
        }
      } catch (error) {
        // If deobfuscation fails, keep the tokens as-is
      }
    }

    return config;
  }

  /**
   * Initialize configuration service
   */
  public static initialize(): ServerConfig {
    console.error('🔧 Loading configuration...');
    
    const config = this.loadConfigWithDeobfuscation();
    const validation = this.validateConfig(config);
    
    if (!validation.isValid) {
      console.error('⚠️  Configuration validation warnings:', validation.errors.join(', '));
    }

    console.error(`📋 Configuration loaded: ${config.company || 'no company'}, token: ${config.token ? 'configured' : 'not configured'}, mode: ${config.mode}`);
    
    return config;
  }
}