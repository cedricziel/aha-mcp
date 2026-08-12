import { describe, it, expect } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import * as z from 'zod/v4';
import { registerTools } from '../src/core/tools.js';
import * as toolOutput from '../src/core/tool-output.js';
import { OUTPUT_SCHEMA_DIALECT, installOutputSchemaDialect } from '../src/core/schema-dialect.js';

/**
 * The dialect a tool advertises decides whether a client will compile its schema at all -
 * Claude Code refused every tool on this server while the output schemas carried the SDK's
 * draft-07 label. So these assertions run over what `tools/list` actually puts on the wire,
 * not over the Zod schemas, and the honesty check below compares the advertised document
 * against a genuine 2020-12 conversion rather than trusting the relabel.
 */

const SDK_DEFAULT_DIALECT = 'http://json-schema.org/draft-07/schema#';

async function listTools(register: (server: McpServer) => void) {
  const server = new McpServer({ name: 'aha-test', version: '1.0.0' });
  installOutputSchemaDialect(server);
  register(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { client, tools: (await client.listTools()).tools };
}

/** Every output schema this server declares, by export name. */
const OUTPUT_SCHEMAS = Object.entries(toolOutput).filter(([name]) =>
  name.endsWith('OutputSchema')
) as [string, z.ZodType][];

describe('installOutputSchemaDialect', () => {
  it('advertises every registered tool output schema in 2020-12', async () => {
    const { tools } = await listTools(registerTools);

    // Guards the premise: a tool with no output schema would pass the loop below vacuously.
    expect(tools.length).toBeGreaterThan(30);
    expect(tools.filter(t => !t.outputSchema).map(t => t.name)).toEqual([]);

    const wrong = tools
      .map(t => ({ name: t.name, dialect: (t.outputSchema as Record<string, unknown>).$schema }))
      .filter(t => t.dialect !== OUTPUT_SCHEMA_DIALECT);
    expect(wrong).toEqual([]);
  });

  it('leaves input schemas in the dialect the SDK emits', async () => {
    const { tools } = await listTools(registerTools);

    // Not an oversight. Input schemas are accepted as draft-07 by the clients this was
    // measured against, and relabelling a dialect nothing has rejected would be a change with
    // no evidence behind it. Pinned so the two sides cannot drift silently.
    for (const tool of tools) {
      const dialect = (tool.inputSchema as Record<string, unknown>).$schema;
      // Zero-argument tools emit no $schema and so default to 2020-12, per the spec.
      expect([SDK_DEFAULT_DIALECT, undefined]).toContain(dialect);
    }
  });

  it('advertises exactly what a 2020-12 conversion of the same schema would', async () => {
    // The relabel would be a lie if the draft-07 target emitted a document the newer dialect
    // reads differently - tuples (`items` vs `prefixItems`) and `$defs` are the usual
    // divergences. Comparing per schema means a future field that does diverge fails here
    // rather than in a client, and the fix at that point is converting at the right target
    // instead of relabelling.
    const { tools } = await listTools(server => {
      for (const [name, schema] of OUTPUT_SCHEMAS) {
        server.registerTool(
          name,
          {
            title: name,
            description: `Probe for ${name}`,
            inputSchema: z.strictObject({}).optional(),
            outputSchema: schema,
            annotations: { title: name, readOnlyHint: true, openWorldHint: false }
          },
          async () => ({ content: [], structuredContent: {} })
        );
      }
    });

    expect(tools.length).toBe(OUTPUT_SCHEMAS.length);

    for (const [name, schema] of OUTPUT_SCHEMAS) {
      const advertised = tools.find(t => t.name === name)!.outputSchema;
      const native = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'output' });
      expect(advertised).toEqual(native as unknown as typeof advertised);
    }
  });

  it('does not give an output schema to a tool that declared none', async () => {
    const { tools } = await listTools(server => {
      server.registerTool(
        'no_output',
        {
          title: 'No output',
          description: 'Declares no output schema',
          inputSchema: z.strictObject({}).optional(),
          annotations: { title: 'No output', readOnlyHint: true, openWorldHint: false }
        },
        async () => ({ content: [{ type: 'text' as const, text: 'ok' }] })
      );
    });

    // `outputSchema` is optional in the spec, and inventing one would commit the tool to
    // returning structuredContent it does not produce.
    expect(tools[0].outputSchema).toBeUndefined();
  });

  it('leaves a raw shape alone rather than changing what it means', async () => {
    const { tools } = await listTools(server => {
      server.registerTool(
        'raw_shape_output',
        {
          title: 'Raw shape output',
          description: 'Declares its output as a raw Zod shape',
          inputSchema: z.strictObject({}).optional(),
          // A shape, not a schema instance: there is no `.meta()` to tag, and wrapping it
          // would change its additionalProperties semantics to fix a dialect. It keeps the
          // SDK default and the registrar logs a warning; the first assertion in this file is
          // what stops a real tool from being registered this way unnoticed.
          outputSchema: { value: z.string() },
          annotations: { title: 'Raw shape output', readOnlyHint: true, openWorldHint: false }
        },
        async () => ({
          content: [{ type: 'text' as const, text: 'ok' }],
          structuredContent: { value: 'ok' }
        })
      );
    });

    expect((tools[0].outputSchema as Record<string, unknown>).$schema).toBe(SDK_DEFAULT_DIALECT);
  });

  it('still validates a real record client-side under the relabelled schema', async () => {
    // The SDK client compiles the advertised schema with draft-07 Ajv, so the relabel has to
    // remain compilable there too - fixing one client by breaking another is not a fix. The
    // client throws on a schema it cannot compile or a payload it rejects, so a call that
    // returns is the assertion.
    const { client } = await listTools(server => {
      server.registerTool(
        'probe_feature',
        {
          title: 'Probe feature',
          description: 'Returns a feature-shaped record',
          inputSchema: z.strictObject({}).optional(),
          outputSchema: toolOutput.featureOutputSchema,
          annotations: { title: 'Probe feature', readOnlyHint: true, openWorldHint: false }
        },
        async () => {
          const feature = {
            id: '6971110726488350000',
            reference_num: 'PRJ1-123',
            name: 'Structured output',
            url: 'https://test.aha.io/features/PRJ1-123',
            progress: 40,
            workflow_status: { id: '1', name: 'In development', complete: false },
            // Undescribed by the schema, and has to survive: Aha returns far more than is
            // typed, so the advertised schema must stay open after the relabel.
            custom_fields: [{ key: 'team', value: 'platform' }]
          };
          return {
            content: [{ type: 'text' as const, text: feature.reference_num }],
            structuredContent: feature
          };
        }
      );
    });

    const result: any = await client.callTool({ name: 'probe_feature', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.reference_num).toBe('PRJ1-123');
    expect(result.structuredContent.custom_fields).toEqual([{ key: 'team', value: 'platform' }]);
  });
});
