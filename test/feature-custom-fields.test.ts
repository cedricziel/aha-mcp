import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from '../src/core/tools.js';
import { AhaService } from '../src/core/services/aha-service.js';

/**
 * The tool tests go through a real client so its zod schema runs. Calling the handler
 * directly would not catch a schema that silently drops the payload.
 */
describe('aha_update_feature_custom_fields', () => {
  const original = AhaService.updateFeatureCustomFields;
  let received: { featureId: string; customFields: any } | null;
  let client: Client;

  beforeEach(async () => {
    received = null;
    (AhaService as any).updateFeatureCustomFields = async (featureId: string, customFields: any) => {
      received = { featureId, customFields };
      return { id: featureId, name: 'Test feature', custom_fields: customFields };
    };

    const server = new McpServer({ name: 'custom-fields-test', version: '1.0.0' }, { capabilities: {} });
    registerTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    (AhaService as any).updateFeatureCustomFields = original;
    await client.close();
  });

  it('forwards every custom field to the service', async () => {
    const customFields = {
      external_id: 'JIRA-42',
      t_shirt_size: 'M',
      confidence: 80,
      is_committed: true,
      stakeholders: ['alice', 'bob']
    };

    await client.callTool({
      name: 'aha_update_feature_custom_fields',
      arguments: { featureId: 'FEAT-1', customFields }
    });

    expect(received).not.toBeNull();
    expect(received!.featureId).toBe('FEAT-1');
    expect(received!.customFields).toEqual(customFields);
  });

  it('reports the updated feature rather than a bare success message', async () => {
    const result: any = await client.callTool({
      name: 'aha_update_feature_custom_fields',
      arguments: { featureId: 'FEAT-2', customFields: { external_id: 'JIRA-7' } }
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('JIRA-7');
  });

  it('advertises an open object in its input schema', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find(t => t.name === 'aha_update_feature_custom_fields');

    expect(tool).toBeDefined();
    const customFields = (tool!.inputSchema as any).properties.customFields;
    expect(customFields.type).toBe('object');
    // z.object({}) would have emitted no additionalProperties at all.
    expect(customFields.additionalProperties).toBeDefined();
  });
});

/**
 * The suite above stubs the service out, so on its own it cannot tell whether the request
 * ever carries the values. This drives the real method against a fake FeaturesApi, which is
 * what catches a regression back to an endpoint that takes no body.
 */
describe('AhaService.updateFeatureCustomFields', () => {
  const originalApi = (AhaService as any).featuresApi;
  let request: any;

  beforeEach(() => {
    request = null;
    (AhaService as any).featuresApi = {
      featuresByIdPut: async (params: any) => {
        request = params;
        return { data: { feature: { id: params.id, name: 'Test feature' } } };
      }
    };
  });

  afterEach(() => {
    (AhaService as any).featuresApi = originalApi;
  });

  it('puts the custom fields in the request body', async () => {
    const customFields = { external_id: 'JIRA-42', stakeholders: ['alice', 'bob'], confidence: 80 };

    await AhaService.updateFeatureCustomFields('FEAT-1', customFields);

    expect(request.id).toBe('FEAT-1');
    expect(request.featuresPutRequest.feature.custom_fields).toEqual(customFields);
  });

  it('returns the updated feature', async () => {
    const feature = await AhaService.updateFeatureCustomFields('FEAT-2', { external_id: 'JIRA-7' });

    expect(feature).toEqual({ id: 'FEAT-2', name: 'Test feature' } as any);
  });

  it('propagates API errors instead of reporting success', async () => {
    (AhaService as any).featuresApi = {
      featuresByIdPut: async () => { throw new Error('422 Unprocessable Entity'); }
    };

    await expect(
      AhaService.updateFeatureCustomFields('FEAT-3', { external_id: 'JIRA-9' })
    ).rejects.toThrow('422 Unprocessable Entity');
  });
});
