import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "./logger.js";

/**
 * The JSON Schema dialect the tool **output** schemas are advertised in.
 *
 * The SDK converts Zod with a hardcoded `draft-7` target and never passes `target` for tools
 * (`toJsonSchemaCompat` in `server/zod-json-schema-compat.js`), so every schema it emits is
 * labelled `http://json-schema.org/draft-07/schema#`. The spec permits an explicit dialect
 * and only *recommends* 2020-12, but a client whose validator implements the recommendation
 * and nothing else rejects the tool outright - measured in Claude Code, which refused every
 * tool on this server with *"invalid outputSchema: JSON Schema declares an unsupported
 * dialect"*, diagnostics and reads included. A dialect a client will not compile is worse
 * than none: it does not degrade the result, it removes the tool.
 *
 * Only the output schemas are relabelled. Input schemas stay on the SDK's draft-07 and are
 * accepted as-is by the clients this was measured against, and rewriting a dialect nothing
 * has complained about would be a change with no evidence behind it.
 */
export const OUTPUT_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";

/**
 * Wrap `server.registerTool` so every tool registered afterwards advertises its output
 * schema in {@link OUTPUT_SCHEMA_DIALECT}.
 *
 * The relabelling works through Zod's metadata registry rather than by editing the converted
 * JSON Schema: `.meta({ $schema })` lands in the emitted document and overrides the target's
 * own `$schema`, which is what lets this sit on the public registration API instead of
 * reaching into the SDK's private `tools/list` handler to patch its output.
 *
 * The tag goes on a *clone* - `.meta()` does not mutate its receiver - which is why this
 * belongs at registration rather than beside each schema's definition. Several output
 * schemas are also nested inside others (`keyResultOutputSchema` inside
 * `keyResultsListOutputSchema`), and a nested subschema carrying its own `$schema` is
 * meaningless; tagging the registered root leaves those occurrences untouched.
 *
 * Patching the registrar rather than the 19 schema declarations is the same bargain
 * `installToolRateLimit` makes: tools are registered from five modules, and something that
 * has to be remembered at every declaration is something that will be missed at the next
 * one.
 *
 * Call before registering any tools - a tool registered ahead of this keeps the SDK default.
 */
export function installOutputSchemaDialect(server: McpServer): void {
  const originalRegisterTool = server.registerTool.bind(server);

  (server as unknown as Record<string, unknown>).registerTool = (
    name: string,
    config: unknown,
    ...rest: unknown[]
  ) => {
    return (originalRegisterTool as (...args: unknown[]) => unknown)(
      name,
      withOutputSchemaDialect(name, config),
      ...rest
    );
  };
}

/**
 * Return `config` with its `outputSchema` tagged, or unchanged when there is nothing to tag.
 *
 * A tool with no output schema is left alone: the spec makes `outputSchema` optional, and
 * inventing one here would commit the tool to returning `structuredContent`.
 */
function withOutputSchemaDialect(name: string, config: unknown): unknown {
  if (!config || typeof config !== "object") return config;

  const outputSchema = (config as { outputSchema?: unknown }).outputSchema;
  if (!outputSchema || typeof outputSchema !== "object") return config;

  const meta = (outputSchema as { meta?: unknown }).meta;
  if (typeof meta !== "function") {
    // A raw Zod shape rather than a schema instance. The SDK accepts one and converts it to
    // an object schema itself, so the tool still works - it just keeps the draft-07 label,
    // and wrapping the shape here would change its `additionalProperties` semantics to fix a
    // dialect. Logged rather than thrown, and asserted over the real tool list in
    // schema-dialect.test.ts so it cannot pass unnoticed.
    log.warn("Tool output schema left in the SDK's default dialect", {
      tool: name,
      reason: "outputSchema is not a Zod schema instance",
      expected: OUTPUT_SCHEMA_DIALECT
    });
    return config;
  }

  return {
    ...(config as object),
    outputSchema: (meta as (metadata: Record<string, unknown>) => unknown).call(outputSchema, {
      $schema: OUTPUT_SCHEMA_DIALECT
    })
  };
}
