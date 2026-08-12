import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AhaService } from '../src/core/services/aha-service.js';

/**
 * The tool tests cannot catch this: they stub the service out, so nothing would notice the
 * request going out with no body at all. This injects a fake FeaturesApi and inspects what the
 * request would actually carry.
 *
 * The original bug was that the generated operation was declared without a request body, so
 * there was no parameter to put the feature in and every create sent an empty POST that Aha
 * accepted silently. aha-js 2.0.0 declares the body, so the payload travels as a typed
 * parameter - but only the assertions below prove it is actually populated.
 */
describe('AhaService.createFeature', () => {
  const original = (AhaService as any).featuresApi;
  let call: { params: any } | null;

  beforeEach(() => {
    call = null;
    (AhaService as any).featuresApi = {
      releasesByReleaseFeaturesPost: async (params: any) => {
        call = { params };
        return { data: { feature: { id: '1', reference_num: 'PRJ1-1' } } };
      }
    };
  });

  afterEach(() => {
    (AhaService as any).featuresApi = original;
  });

  it('sends the feature in the request body', async () => {
    await AhaService.createFeature('PRJ1-R-1', { feature: { name: 'Silence by label' } });

    expect(call!.params.releaseId).toBe('PRJ1-R-1');
    // The whole bug: this used to be unsendable, so Aha received an empty POST.
    expect(call!.params.featuresPostRequest).toEqual({ feature: { name: 'Silence by label' } });
  });

  it('wraps a bare record rather than posting it unwrapped', async () => {
    await AhaService.createFeature('PRJ1-R-1', { name: 'Silence by label' });

    expect(call!.params.featuresPostRequest).toEqual({ feature: { name: 'Silence by label' } });
  });

  it('does not double-wrap an already wrapped payload', async () => {
    await AhaService.createFeature('PRJ1-R-1', { feature: { name: 'X' } });

    expect(call!.params.featuresPostRequest.feature.feature).toBeUndefined();
  });

  it('still posts a feature key when given nothing', async () => {
    // Better an empty feature Aha can reject than a bodyless POST it silently accepts.
    await AhaService.createFeature('PRJ1-R-1', undefined);

    expect(call!.params.featuresPostRequest).toEqual({ feature: {} });
  });

  it('returns what Aha sends back, so the caller can link the new record', async () => {
    const created = await AhaService.createFeature('PRJ1-R-1', { feature: { name: 'X' } });

    expect(created).toEqual({ feature: { id: '1', reference_num: 'PRJ1-1' } } as any);
  });

  it('propagates a rejection instead of reporting success', async () => {
    (AhaService as any).featuresApi = {
      releasesByReleaseFeaturesPost: async () => {
        throw new Error('422 Unprocessable Entity');
      }
    };

    await expect(
      AhaService.createFeature('PRJ1-R-1', { feature: { name: 'X' } })
    ).rejects.toThrow('422 Unprocessable Entity');
  });
});
