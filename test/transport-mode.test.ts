import { describe, it, expect } from 'bun:test';
import { normalizeTransportMode, ConfigService } from '../src/core/config';

/**
 * The `sse` transport was removed after the MCP spec deprecated it in 2025-03-26. Existing
 * configurations must keep starting, so it maps to streamable-http rather than being rejected.
 */
describe('transport modes', () => {
  describe('normalizeTransportMode', () => {
    it.each(['stdio', 'streamable-http'])('accepts %p unchanged', value => {
      expect(normalizeTransportMode(value)).toEqual({ mode: value as any, migrated: false });
    });

    it('maps the removed sse mode to streamable-http', () => {
      expect(normalizeTransportMode('sse')).toEqual({ mode: 'streamable-http', migrated: true });
    });

    it.each(['SSE', ' sse ', 'Sse'])('migrates %p regardless of case or padding', value => {
      expect(normalizeTransportMode(value)).toEqual({ mode: 'streamable-http', migrated: true });
    });

    it.each(['STDIO', 'Streamable-HTTP'])('normalises case for %p', value => {
      expect(normalizeTransportMode(value)?.migrated).toBe(false);
    });

    it.each(['websocket', '', 'http', 'grpc'])('rejects unknown mode %p', value => {
      expect(normalizeTransportMode(value)).toBeNull();
    });
  });

  describe('validateConfig', () => {
    const base = {
      company: 'acme',
      token: 'a-valid-token',
      port: 3001,
      host: '0.0.0.0'
    };

    it('accepts stdio', () => {
      const r = ConfigService.validateConfig({ ...base, mode: 'stdio' } as any);
      expect(r.errors).toEqual([]);
    });

    it('accepts streamable-http', () => {
      const r = ConfigService.validateConfig({ ...base, mode: 'streamable-http' } as any);
      expect(r.errors).toEqual([]);
    });

    it('rejects sse with a message naming the replacement', () => {
      const r = ConfigService.validateConfig({ ...base, mode: 'sse' } as any);
      expect(r.isValid).toBe(false);
      expect(r.errors.join(' ')).toContain('streamable-http');
    });

    it('still requires a port for the HTTP transport', () => {
      const r = ConfigService.validateConfig({ ...base, mode: 'streamable-http', port: 0 } as any);
      expect(r.errors.join(' ')).toMatch(/[Pp]ort/);
    });

    it('still requires a host for the HTTP transport', () => {
      const r = ConfigService.validateConfig({ ...base, mode: 'streamable-http', host: '  ' } as any);
      expect(r.errors.join(' ')).toMatch(/[Hh]ost/);
    });

    it('does not require port or host for stdio', () => {
      const r = ConfigService.validateConfig({
        ...base,
        mode: 'stdio',
        port: undefined,
        host: undefined
      } as any);
      expect(r.errors).toEqual([]);
    });
  });
});
