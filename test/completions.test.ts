import { describe, it, expect } from 'bun:test';
import {
  completeProduct,
  completeRecordReference,
  completeRecordReferenceList,
  referenceNumberFromUrl,
  type CompletionSources
} from '../src/core/completions.js';

const PRODUCTS = [
  { reference_prefix: 'ADAPTTELE', name: 'Adaptive Telemetry' },
  { reference_prefix: 'ALERT', name: 'Alerting' },
  { reference_prefix: 'APPO11Y', name: 'Application Observability' }
];

/** Records what was asked for, so the tests can assert the query as well as the result. */
function sources(over: Partial<CompletionSources> = {}) {
  const searches: Array<{ type: string; query: string }> = [];
  const base: CompletionSources = {
    listProducts: async () => PRODUCTS,
    searchRecords: async (type, query) => {
      searches.push({ type, query });
      return [];
    }
  };
  return { sources: { ...base, ...over }, searches };
}

const hits = (...refs: string[]) =>
  refs.map(ref => ({ name: ref, url: `https://acme.aha.io/features/${ref}` }));

describe('referenceNumberFromUrl', () => {
  it('takes the reference number from the last path segment', () => {
    expect(referenceNumberFromUrl('https://acme.aha.io/features/PRJ1-1')).toBe('PRJ1-1');
  });

  it('handles the nested path ideas use', () => {
    expect(referenceNumberFromUrl('https://acme.aha.io/ideas/ideas/PRJ1-I-9')).toBe('PRJ1-I-9');
  });

  it('decodes an escaped segment', () => {
    expect(referenceNumberFromUrl('https://acme.aha.io/features/PRJ1%2D1')).toBe('PRJ1-1');
  });

  it('returns null rather than throwing on something that is not a url', () => {
    expect(referenceNumberFromUrl('/features/PRJ1-1')).toBeNull();
    expect(referenceNumberFromUrl('')).toBeNull();
  });
});

describe('completeProduct', () => {
  it('matches on the reference prefix and inserts the prefix', async () => {
    const { sources: s } = sources();
    expect(await completeProduct('reference_prefix', s)('APP')).toEqual(['APPO11Y']);
  });

  it('matches on the name and inserts the name', async () => {
    const { sources: s } = sources();
    expect(await completeProduct('name', s)('alert')).toEqual(['Alerting']);
  });

  it('finds a workspace by name even when completing the prefix field', async () => {
    // The point of the feature: knowing "Alerting" but not that it is ALERT.
    const { sources: s } = sources();
    expect(await completeProduct('reference_prefix', s)('Alerting')).toEqual(['ALERT']);
  });

  it('offers everything when nothing has been typed', async () => {
    const { sources: s } = sources();
    expect(await completeProduct('reference_prefix', s)('')).toEqual([
      'ADAPTTELE',
      'ALERT',
      'APPO11Y'
    ]);
  });

  it('returns nothing rather than throwing when the account cannot be reached', async () => {
    const { sources: s } = sources({
      listProducts: async () => {
        throw new Error('401 Unauthorized');
      }
    });
    expect(await completeProduct('name', s)('a')).toEqual([]);
  });
});

describe('completeRecordReference', () => {
  it('searches the typed value as a prefix, scoped to the record type', async () => {
    const { sources: s, searches } = sources();
    await completeRecordReference('Epic', s)('PRJ1-E');

    expect(searches).toEqual([{ type: 'Epic', query: 'PRJ1-E*' }]);
  });

  it('costs no request when nothing has been typed', async () => {
    const { sources: s, searches } = sources();

    expect(await completeRecordReference('Feature', s)('')).toEqual([]);
    expect(searches).toEqual([]);
  });

  it('derives reference numbers from the hit urls', async () => {
    const { sources: s } = sources({ searchRecords: async () => hits('PRJ1-1', 'PRJ1-2') });
    expect(await completeRecordReference('Feature', s)('PRJ1')).toEqual(['PRJ1-1', 'PRJ1-2']);
  });

  it('puts prefix matches first, since Aha search is fuzzy', async () => {
    // Typing PRJ1-13 really does return PRJ1-2 and PRJ1-53 from a live account.
    const { sources: s } = sources({
      searchRecords: async () => hits('PRJ1-2', 'PRJ1-134', 'PRJ1-53', 'PRJ1-13')
    });

    expect(await completeRecordReference('Feature', s)('PRJ1-13')).toEqual([
      'PRJ1-134',
      'PRJ1-13',
      'PRJ1-2',
      'PRJ1-53'
    ]);
  });

  it('drops duplicates and hits whose url yields nothing', async () => {
    const { sources: s } = sources({
      searchRecords: async () => [
        ...hits('PRJ1-1', 'PRJ1-1'),
        { name: 'broken', url: 'not-a-url' }
      ]
    });
    expect(await completeRecordReference('Feature', s)('PRJ1')).toEqual(['PRJ1-1']);
  });

  it('returns nothing rather than throwing when search fails', async () => {
    const { sources: s } = sources({
      searchRecords: async () => {
        throw new Error('429 Too Many Requests');
      }
    });
    expect(await completeRecordReference('Idea', s)('PRJ1-I')).toEqual([]);
  });
});

describe('completeRecordReferenceList', () => {
  it('completes the only entry when the list has one', async () => {
    const { sources: s } = sources({ searchRecords: async () => hits('PRJ1-I-9') });
    expect(await completeRecordReferenceList('Idea', s)('PRJ1-I')).toEqual(['PRJ1-I-9']);
  });

  it('keeps the entries already listed', async () => {
    const { sources: s } = sources({ searchRecords: async () => hits('PRJ1-I-9') });

    expect(await completeRecordReferenceList('Idea', s)('PRJ1-I-1,PRJ1-I')).toEqual([
      'PRJ1-I-1,PRJ1-I-9'
    ]);
  });

  it('preserves the spacing the user typed after the comma', async () => {
    const { sources: s } = sources({ searchRecords: async () => hits('PRJ1-I-9') });

    expect(await completeRecordReferenceList('Idea', s)('PRJ1-I-1, PRJ1-I')).toEqual([
      'PRJ1-I-1, PRJ1-I-9'
    ]);
  });

  it('searches only the last entry, not the whole list', async () => {
    const { sources: s, searches } = sources();
    await completeRecordReferenceList('Idea', s)('PRJ1-I-1,PRJ1-I-2');

    expect(searches).toEqual([{ type: 'Idea', query: 'PRJ1-I-2*' }]);
  });

  it('offers nothing for a trailing comma rather than searching the whole list', async () => {
    const { sources: s, searches } = sources();

    expect(await completeRecordReferenceList('Idea', s)('PRJ1-I-1,')).toEqual([]);
    expect(searches).toEqual([]);
  });
});
