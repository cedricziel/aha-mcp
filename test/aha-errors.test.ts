import { describe, it, expect } from 'bun:test';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  describeAhaError,
  retryAfterOf,
  statusOf,
  toMcpError
} from '../src/core/services/aha-errors.js';

/** An axios-shaped failure, which is what `aha-js` throws. */
const httpError = (status: number, headers: Record<string, unknown> = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, headers }
  });

/** A request that never got a response - DNS failure, offline, wrong subdomain. */
const transportError = () =>
  Object.assign(new Error('getaddrinfo ENOTFOUND nope.aha.io'), { isAxiosError: true });

describe('statusOf', () => {
  it('reads the status off an axios error', () => {
    expect(statusOf(httpError(403))).toBe(403);
  });

  it('returns null for errors that are not HTTP responses', () => {
    expect(statusOf(transportError())).toBeNull();
    expect(statusOf(new Error('boom'))).toBeNull();
    expect(statusOf('boom')).toBeNull();
    expect(statusOf(null)).toBeNull();
  });
});

describe('retryAfterOf', () => {
  it('reads Aha\'s retry_after header', () => {
    expect(retryAfterOf(httpError(429, { retry_after: '30' }))).toBe('30');
  });

  it('also accepts the hyphenated spelling', () => {
    expect(retryAfterOf(httpError(429, { 'retry-after': 12 }))).toBe('12');
  });

  it('returns null when there is no header', () => {
    expect(retryAfterOf(httpError(429))).toBeNull();
  });
});

describe('describeAhaError', () => {
  it('says a 403 is a permission problem, not a bad request', () => {
    const message = describeAhaError(httpError(403), 'aha://feature/PRJ1-1');

    expect(message).toContain('aha://feature/PRJ1-1');
    expect(message).toContain('403');
    expect(message).toMatch(/permission/i);
    // The distinction the old raw message lost entirely.
    expect(message).not.toBe('Request failed with status code 403');
  });

  it('admits a 404 may mean "exists but you cannot see it"', () => {
    // Aha returns 404 for a missing record and for one the token cannot reach, so the
    // message must not claim the record does not exist.
    const message = describeAhaError(httpError(404), 'PRJ1-99');

    expect(message).toContain('PRJ1-99');
    expect(message).toMatch(/do not have access|cannot see/i);
  });

  it('points at the credentials for a 401', () => {
    expect(describeAhaError(httpError(401))).toMatch(/AHA_TOKEN|configure_server/);
  });

  it('quotes retry_after and the documented limits on a 429', () => {
    const message = describeAhaError(httpError(429, { retry_after: '30' }));

    expect(message).toContain('30');
    expect(message).toContain('300 requests per minute');
  });

  it('does not invent a retry hint when the header is absent', () => {
    expect(describeAhaError(httpError(429))).not.toContain('retry after');
  });

  it('attributes a 5xx to Aha rather than the request', () => {
    expect(describeAhaError(httpError(503), 'PRJ1-1')).toMatch(/on Aha's side/);
  });

  it('distinguishes not reaching Aha from being refused by it', () => {
    const message = describeAhaError(transportError());

    expect(message).toMatch(/Could not reach Aha/);
    expect(message).toContain('ENOTFOUND');
    expect(message).toMatch(/subdomain/);
  });

  it('passes through errors this server raises itself', () => {
    // These already say something useful; wrapping them would only bury it.
    const own = new Error('Aha.io API token is not configured. Set AHA_TOKEN or call configure_server.');

    expect(describeAhaError(own)).toBe(own.message);
  });

  it('survives being handed something that is not an error', () => {
    expect(describeAhaError('just a string')).toBe('just a string');
    expect(describeAhaError(undefined)).toBe('undefined');
  });

  it('names the record generically when no subject is given', () => {
    expect(describeAhaError(httpError(404))).toContain('the requested record');
  });
});

describe('toMcpError', () => {
  it('reports an inaccessible record as InvalidParams, not InternalError', () => {
    // The old behaviour let a raw error become -32603, which reads as a server bug.
    for (const status of [403, 404, 400]) {
      expect(toMcpError(httpError(status), 'aha://feature/PRJ1-1').code).toBe(
        ErrorCode.InvalidParams
      );
    }
  });

  it('keeps genuine server-side and unclassified failures as InternalError', () => {
    for (const status of [500, 502, 429, 401]) {
      expect(toMcpError(httpError(status)).code).toBe(ErrorCode.InternalError);
    }
    expect(toMcpError(transportError()).code).toBe(ErrorCode.InternalError);
  });

  it('carries the explanation into the error message', () => {
    expect(toMcpError(httpError(403), 'aha://idea/PRJ1-I-1').message).toContain(
      'aha://idea/PRJ1-I-1'
    );
  });

  it('leaves an McpError alone rather than double-wrapping it', () => {
    const original = new McpError(ErrorCode.InvalidParams, 'Invalid feature ID');

    expect(toMcpError(original)).toBe(original);
  });
});
