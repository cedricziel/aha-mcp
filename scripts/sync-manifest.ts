/**
 * Regenerate `manifest.json`'s tool list from a running server.
 *
 * CLAUDE.md requires the manifest to match what the server actually registers, and to be
 * regenerated rather than hand-edited - but nothing automated it, so a tool description
 * changed in `src/core/tools.ts` silently left the desktop extension describing the old
 * behaviour. This spawns the real server over stdio and copies `tools/list` verbatim.
 *
 * Prompts stay untouched: the manifest declares `prompts_generated: true`, because the
 * bundle schema demands a `text` field on any statically listed prompt and the server
 * generates that at runtime.
 *
 *   bun run manifest:sync            # rewrite manifest.json
 *   bun run manifest:sync --check    # exit 1 if it would change, for CI
 */
import { readFileSync, writeFileSync } from "node:fs";
import { TestMCPClient } from "../test/utils/mcp-client-helper.js";

const check = process.argv.includes("--check");
const path = "manifest.json";

const client = new TestMCPClient();
let tools: { name: string; description: string }[];

try {
  // Credentials the server accepts but never spends: registration does not call Aha.
  await client.connect({ company: "manifest-sync", token: "manifest-sync" });
  tools = (await client.listTools())
    .map(tool => ({ name: tool.name, description: tool.description ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
} finally {
  await client.disconnect();
}

const manifest = JSON.parse(readFileSync(path, "utf8"));
const before = JSON.stringify(manifest.tools);
manifest.tools = tools;
const after = JSON.stringify(tools);

if (before === after) {
  console.log(`manifest.json already lists all ${tools.length} tools correctly`);
  process.exit(0);
}

if (check) {
  console.error(
    `manifest.json is out of date: it lists ${JSON.parse(before).length} tools, the server ` +
      `registers ${tools.length}. Run 'bun run manifest:sync'.`
  );
  process.exit(1);
}

writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest.json updated with ${tools.length} tools`);
