import { describe, it, expect } from 'bun:test';
import { QueryAwareUriTemplate, ResourceTemplate } from '../src/core/uri-template';

/**
 * Guards the locally vendored fix from modelcontextprotocol/typescript-sdk#1083.
 *
 * The released SDK's UriTemplate.match() requires every query parameter of a
 * {?a,b,c} expression to be present, in order, unencoded. These tests pin the
 * relaxed behaviour that the Aha resource templates depend on. If PR #1083 lands
 * upstream, src/core/uri-template.ts can go away and these tests should still pass
 * against the plain SDK UriTemplate.
 */

const FEATURES = 'aha://features{?query,updatedSince,tag,assignedToUser,page,perPage}';

describe('QueryAwareUriTemplate', () => {
  describe('query parameter matching', () => {
    it('matches the bare URI with no query string, defaulting params to empty strings', () => {
      const result = new QueryAwareUriTemplate(FEATURES).match('aha://features');

      expect(result).toEqual({
        query: '',
        updatedSince: '',
        tag: '',
        assignedToUser: '',
        page: '',
        perPage: ''
      });
    });

    it('matches a single query parameter', () => {
      const result = new QueryAwareUriTemplate(FEATURES).match('aha://features?page=1');

      expect(result?.page).toBe('1');
      expect(result?.perPage).toBe('');
    });

    it('matches query parameters given out of template order', () => {
      const result = new QueryAwareUriTemplate(FEATURES).match('aha://features?perPage=50&query=login&page=2');

      expect(result?.query).toBe('login');
      expect(result?.page).toBe('2');
      expect(result?.perPage).toBe('50');
      expect(result?.tag).toBe('');
    });

    it('percent-decodes keys and values', () => {
      const result = new QueryAwareUriTemplate(FEATURES).match('aha://features?query=user%20login&tag=a%2Fb');

      expect(result?.query).toBe('user login');
      expect(result?.tag).toBe('a/b');
    });

    it('tolerates malformed percent-encoding rather than throwing', () => {
      const result = new QueryAwareUriTemplate(FEATURES).match('aha://features?query=100%');

      expect(result?.query).toBe('100%');
    });

    it('ignores query parameters the template does not name', () => {
      const result = new QueryAwareUriTemplate(FEATURES).match('aha://features?page=1&unexpected=x');

      expect(result?.page).toBe('1');
      expect(result).not.toHaveProperty('unexpected');
    });

    it('returns null when the path does not match', () => {
      expect(new QueryAwareUriTemplate(FEATURES).match('aha://ideas?page=1')).toBeNull();
    });
  });

  describe('path parameter matching', () => {
    it('still extracts path variables', () => {
      expect(new QueryAwareUriTemplate('aha://feature/{id}').match('aha://feature/FEAT-123')).toEqual({
        id: 'FEAT-123'
      });
    });

    it('matches a template with both path and query variables', () => {
      const result = new QueryAwareUriTemplate('aha://product/{productId}/ideas{?page}').match(
        'aha://product/PROD-1/ideas?page=3'
      );

      expect(result).toEqual({ productId: 'PROD-1', page: '3' });
    });

    it('tolerates a query string on a template that declares none', () => {
      expect(new QueryAwareUriTemplate('aha://feature/{id}').match('aha://feature/FEAT-123?x=1')).toEqual({
        id: 'FEAT-123'
      });
    });

    it('returns null on a path mismatch', () => {
      expect(new QueryAwareUriTemplate('aha://feature/{id}').match('aha://idea/IDEA-1')).toBeNull();
    });

    it('expands an exploded variable into a list', () => {
      expect(new QueryAwareUriTemplate('aha://features/{id*}').match('aha://features/A,B')).toEqual({
        id: ['A', 'B']
      });
    });

    it('keeps commas verbatim for a non-exploded greedy variable', () => {
      // A `+` variable matches greedily, so unlike the path patterns it can contain a
      // comma - splitting it here would diverge from the SDK's expand()/match() pairing.
      expect(new QueryAwareUriTemplate('aha://{+path}').match('aha://a,b')).toEqual({ path: 'a,b' });
    });
  });

  describe('inherited behaviour', () => {
    it('keeps the SDK expand() implementation', () => {
      const template = new QueryAwareUriTemplate(FEATURES);

      expect(template.expand({ page: '2', perPage: '50' })).toBe('aha://features?page=2&perPage=50');
    });

    it('exposes variableNames', () => {
      expect(new QueryAwareUriTemplate('aha://feature/{id}').variableNames).toEqual(['id']);
    });

    it('round-trips toString()', () => {
      expect(new QueryAwareUriTemplate(FEATURES).toString()).toBe(FEATURES);
    });
  });
});

describe('ResourceTemplate', () => {
  it('wraps string templates in a QueryAwareUriTemplate', () => {
    const template = new ResourceTemplate(FEATURES, { list: undefined });

    expect(template.uriTemplate).toBeInstanceOf(QueryAwareUriTemplate);
    expect(template.uriTemplate.match('aha://features?page=1')?.page).toBe('1');
  });

  it('passes through an already-constructed template', () => {
    const uriTemplate = new QueryAwareUriTemplate(FEATURES);
    const template = new ResourceTemplate(uriTemplate, { list: undefined });

    expect(template.uriTemplate).toBe(uriTemplate);
  });

  it('preserves the list and complete callbacks', async () => {
    const list = async () => ({ resources: [] });
    const template = new ResourceTemplate(FEATURES, {
      list,
      complete: { page: async () => ['1', '2'] }
    });

    expect(template.listCallback).toBe(list);
    expect(await template.completeCallback('page')?.('', {} as never)).toEqual(['1', '2']);
  });
});
