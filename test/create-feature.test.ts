import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AhaService } from '../src/core/services/aha-service.js';

/**
 * The tool tests cannot catch this: they stub the service out, so nothing would notice the
 * request going out with no body at all. This injects a fake DefaultApi and inspects what the
 * request would actually carry.
 */
describe('AhaService.createFeature', () => {
  const original = (AhaService as any).defaultApi;
  let call: { params: any; options: any } | null;

  beforeEach(() => {
    call = null;
    (AhaService as any).defaultApi = {
      releasesReleaseIdFeaturesPost: async (params: any, options: any) => {
        call = { params, options };
        return { data: { feature: { id: '1', reference_num: 'PRJ1-1' } } };
      }
    };
  });

  afterEach(() => {
    (AhaService as any).defaultApi = original;
  });

  it('sends the feature in the request body', async () => {
    await AhaService.createFeature('PRJ1-R-1', { feature: { name: 'Silence by label' } });

    expect(call!.params.releaseId).toBe('PRJ1-R-1');
    // The whole bug: this used to be undefined, so Aha received an empty POST.
    expect(call!.options.data).toEqual({ feature: { name: 'Silence by label' } });
  });

  it('wraps a bare record rather than posting it unwrapped', async () => {
    await AhaService.createFeature('PRJ1-R-1', { name: 'Silence by label' });

    expect(call!.options.data).toEqual({ feature: { name: 'Silence by label' } });
  });

  it('does not double-wrap an already wrapped payload', async () => {
    await AhaService.createFeature('PRJ1-R-1', { feature: { name: 'X' } });

    expect(call!.options.data.feature.feature).toBeUndefined();
  });

  it('sends JSON', async () => {
    await AhaService.createFeature('PRJ1-R-1', { feature: { name: 'X' } });

    expect(call!.options.headers['Content-Type']).toBe('application/json');
  });

  it('still posts a feature key when given nothing', async () => {
    // Better an empty feature Aha can reject than a bodyless POST it silently accepts.
    await AhaService.createFeature('PRJ1-R-1', undefined);

    expect(call!.options.data).toEqual({ feature: {} });
  });

  it('returns what Aha sends back, so the caller can link the new record', async () => {
    const created = await AhaService.createFeature('PRJ1-R-1', { feature: { name: 'X' } });

    expect(created).toEqual({ feature: { id: '1', reference_num: 'PRJ1-1' } } as any);
  });

  it('propagates a rejection instead of reporting success', async () => {
    (AhaService as any).defaultApi = {
      releasesReleaseIdFeaturesPost: async () => {
        throw new Error('422 Unprocessable Entity');
      }
    };

    await expect(
      AhaService.createFeature('PRJ1-R-1', { feature: { name: 'X' } })
    ).rejects.toThrow('422 Unprocessable Entity');
  });
});
