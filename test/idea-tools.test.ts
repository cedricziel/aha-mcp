import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AhaService } from "../src/core/services/aha-service.js";
import { registerIdeaTools } from "../src/core/tools/idea-tools.js";

const IDEA = {
  id: "7615609440903611104",
  reference_num: "PRJ1-I-7",
  name: "Improve import feedback",
  updated_at: "2026-09-21T10:00:00.000Z",
  workflow_status: { id: "2", name: "Product evaluating" },
  url: "https://test.aha.io/ideas/PRJ1-I-7"
};

async function connected() {
  const server = new McpServer({ name: "aha-test", version: "1.0.0" });
  registerIdeaTools(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("Idea update tool", () => {
  const originalUpdateIdea = AhaService.updateIdea;

  afterEach(() => {
    AhaService.updateIdea = originalUpdateIdea;
  });

  it("updates workflow status through a validated, wrapped idea payload", async () => {
    const calls: any[] = [];
    AhaService.updateIdea = async (ideaId: string, ideaData: any) => {
      calls.push({ ideaId, ideaData });
      return { idea: IDEA };
    };
    const client = await connected();

    const result: any = await client.callTool({
      name: "aha_update_idea",
      arguments: {
        ideaId: "PRJ1-I-7",
        ideaData: { idea: { workflow_status: "Product evaluating" } }
      }
    });

    expect(calls).toEqual([
      {
        ideaId: "PRJ1-I-7",
        ideaData: { idea: { workflow_status: "Product evaluating" } }
      }
    ]);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(IDEA);
    expect(result.content[0].text).toBe(
      'Updated idea PRJ1-I-7 "Improve import feedback" - https://test.aha.io/ideas/PRJ1-I-7'
    );
    expect(result.content[1].uri).toBe("aha://idea/PRJ1-I-7");
  });

  it("advertises the writer annotations and supported routine fields", async () => {
    const client = await connected();
    const tool = (await client.listTools()).tools.find(item => item.name === "aha_update_idea")!;
    const ideaProperties = (tool.inputSchema.properties?.ideaData as any).properties.idea.properties;

    expect(tool.title).toBe("Update idea");
    expect(tool.annotations).toEqual({
      title: "Update idea",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    });
    expect(Object.keys(ideaProperties).sort()).toEqual([
      "assigned_to_user",
      "custom_fields",
      "description",
      "name",
      "workflow_status"
    ]);
  });

  it("rejects an update with no fields before it reaches Aha", async () => {
    let called = false;
    AhaService.updateIdea = async () => {
      called = true;
      return { idea: IDEA };
    };
    const client = await connected();

    const result: any = await client.callTool({
      name: "aha_update_idea",
      arguments: { ideaId: "PRJ1-I-7", ideaData: { idea: {} } }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Provide at least one idea field to update");
    expect(called).toBe(false);
  });
});

describe("AhaService.updateIdea", () => {
  const originalIdeasApi = (AhaService as any).ideasApi;
  let call: any;

  beforeEach(() => {
    call = undefined;
    (AhaService as any).ideasApi = {
      ideasByIdPut: async (params: any) => {
        call = params;
        return { data: { idea: IDEA } };
      }
    };
  });

  afterEach(() => {
    (AhaService as any).ideasApi = originalIdeasApi;
  });

  it("sends the complete idea body despite the generated SDK's incomplete request type", async () => {
    const payload = {
      idea: {
        workflow_status: "Product evaluating",
        assigned_to_user: "owner@example.com",
        custom_fields: { priority: "P1" }
      }
    };

    const result = await AhaService.updateIdea("PRJ1-I-7", payload);

    expect(call).toEqual({ id: "PRJ1-I-7", ideasPutRequest: payload });
    expect(result).toEqual({ idea: IDEA });
  });

  it("wraps a bare idea record exactly once", async () => {
    await AhaService.updateIdea("PRJ1-I-7", { name: "Clearer name" });
    expect(call.ideasPutRequest).toEqual({ idea: { name: "Clearer name" } });

    await AhaService.updateIdea("PRJ1-I-7", { idea: { name: "Already wrapped" } });
    expect(call.ideasPutRequest).toEqual({ idea: { name: "Already wrapped" } });
  });
});
