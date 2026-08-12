import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "./logger.js";

/**
 * Tool invocation rate limiting, which the tools specification requires of servers.
 *
 * The bucket is process-wide rather than per-session: what it protects is Aha's API, which
 * every session shares, and a per-session budget would let N sessions multiply the load on
 * it. Local-only tools (`server_status`, `get_server_config`) draw from the same bucket -
 * a burst of those is still a burst, and separate budgets would mean a caller could not
 * predict what it is allowed to do next.
 *
 * Refusals come back as tool execution errors with `isError`, not JSON-RPC errors: the spec
 * reserves protocol errors for requests a model cannot fix, and "wait and retry" is exactly
 * the kind of feedback a model can act on.
 */

/** Requests per minute allowed by default. Override with MCP_TOOL_RATE_LIMIT_PER_MINUTE. */
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 120;

export interface TokenBucketOptions {
  /** Sustained rate, in invocations per minute. */
  perMinute: number;
  /** Injectable clock, in milliseconds. Defaults to Date.now. */
  now?: () => number;
}

/**
 * A token bucket: `perMinute` tokens of burst capacity, refilling continuously at
 * `perMinute / 60` per second. Capacity equal to the rate keeps the knob to one number -
 * "120 a minute" also means "at most 120 back to back".
 */
export class TokenBucket {
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly now: () => number;
  private tokens: number;
  private lastRefill: number;

  constructor(options: TokenBucketOptions) {
    this.capacity = Math.max(1, options.perMinute);
    this.refillPerMs = this.capacity / 60_000;
    this.now = options.now ?? (() => Date.now());
    this.tokens = this.capacity;
    this.lastRefill = this.now();
  }

  /**
   * Take a token if one is available.
   *
   * @returns `null` when the call may proceed, or the whole seconds to wait when it may not.
   */
  public take(): number | null {
    const now = this.now();
    // Clamped: `Date.now()` can move backward across an NTP correction, and a negative
    // elapsed time would subtract tokens rather than add them, locking callers out until the
    // bucket recovered.
    const elapsed = Math.max(0, now - this.lastRefill);
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return null;
    }

    // Round up, so a caller that honours the number always finds a token waiting.
    return Math.max(1, Math.ceil((1 - this.tokens) / this.refillPerMs / 1000));
  }
}

/**
 * Read the configured limit. `0` disables rate limiting, which exists for tests and for
 * operators running the server against a private account where the only client is
 * themselves.
 */
export function configuredRateLimit(env: Record<string, string | undefined> = process.env): number {
  const raw = env.MCP_TOOL_RATE_LIMIT_PER_MINUTE;
  if (raw === undefined || raw.trim() === '') return DEFAULT_RATE_LIMIT_PER_MINUTE;

  const parsed = Number(raw);
  // Integers only. Flooring a fractional value used to turn `0.5` into `0`, and `0` is the
  // documented way to disable rate limiting entirely - so a typo silently removed the limit
  // while skipping the warning below.
  if (!Number.isInteger(parsed) || parsed < 0) {
    log.warn('Ignoring invalid MCP_TOOL_RATE_LIMIT_PER_MINUTE', {
      value: raw,
      reason: Number.isFinite(parsed) ? 'expected a non-negative whole number' : 'not a number',
      using: DEFAULT_RATE_LIMIT_PER_MINUTE
    });
    return DEFAULT_RATE_LIMIT_PER_MINUTE;
  }

  return parsed;
}

/**
 * Wrap `server.registerTool` so every tool registered afterwards spends a token before its
 * handler runs.
 *
 * Patching the registrar rather than each handler is what keeps this enforceable: tools are
 * registered from three different modules, and a limiter that has to be remembered at 31
 * call sites is one that will be forgotten at the 32nd.
 *
 * Call before registering any tools. Returns the bucket, or null when disabled.
 */
export function installToolRateLimit(
  server: McpServer,
  options: { perMinute?: number; now?: () => number } = {}
): TokenBucket | null {
  const perMinute = options.perMinute ?? configuredRateLimit();
  if (perMinute === 0) {
    log.info('Tool rate limiting disabled', { reason: 'MCP_TOOL_RATE_LIMIT_PER_MINUTE=0' });
    return null;
  }

  const bucket = new TokenBucket({ perMinute, now: options.now });
  const originalRegisterTool = server.registerTool.bind(server);

  (server as unknown as Record<string, unknown>).registerTool = (
    name: string,
    config: unknown,
    handler: unknown
  ) => {
    // Task handlers are objects rather than callbacks; nothing here registers one, and
    // wrapping something we do not understand would be worse than leaving it alone.
    if (typeof handler !== 'function') {
      return (originalRegisterTool as (...args: unknown[]) => unknown)(name, config, handler);
    }

    const guarded = async (...args: unknown[]) => {
      const retryAfterSeconds = bucket.take();
      if (retryAfterSeconds !== null) {
        log.warn('Tool call refused by rate limit', { tool: name, retry_after_seconds: retryAfterSeconds });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Rate limit reached: this server allows ${perMinute} tool calls per minute. ` +
                `Retry ${name} in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`
            }
          ],
          isError: true
        };
      }

      return (handler as (...args: unknown[]) => unknown)(...args);
    };

    return (originalRegisterTool as (...args: unknown[]) => unknown)(name, config, guarded);
  };

  log.info('Tool rate limiting enabled', { per_minute: perMinute });
  return bucket;
}
