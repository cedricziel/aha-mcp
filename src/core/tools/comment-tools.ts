import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as services from "../services/index.js";
import {
  commentListOutputSchema,
  commentOutputSchema,
  ideaCommentOutputSchema,
  recordLinks,
  type LinkableRecordType
} from "../tool-output.js";
import { describeAhaError } from "../services/aha-errors.js";
import { log } from "../logger.js";
import type { Comment, IdeaComment } from "../types/aha-types.js";

/**
 * Comment tools.
 *
 * Two things shaped these beyond "wrap the endpoints":
 *
 * 1. **Ideas have two comment streams, not one.** `/ideas/{id}/comments` holds internal
 *    comments; `/ideas/{id}/idea_comments` holds the conversation that can reach the ideas
 *    portal. They are disjoint - measured on a live idea: one internal comment, two portal
 *    comments, no shared ids - and the portal side is where a customer's own words are. A
 *    reader that returns only the first looks complete while omitting the half that usually
 *    matters for triage, so `aha_list_comments` reads both for ideas and labels every comment
 *    with its `source`.
 * 2. **Publishing to customers must be deliberate.** Aha defaults an idea comment's
 *    visibility to `public`, so a caller that omits the field is talking to customers by
 *    accident. `aha_create_idea_portal_comment` therefore takes `visibility` as a required
 *    argument and is a separate tool from `aha_create_comment`, which only ever writes
 *    internally. Two tools rather than one flag means a host that gates writes can gate the
 *    customer-facing one on its own.
 */

/** How each record type reaches its comments, and what to link to afterwards. */
interface CommentTarget {
  /** Value of the `recordType` argument. */
  key: string;
  /** URI segment for the parent record's resource, when it has one. */
  link: LinkableRecordType;
  read: (id: string) => Promise<{ comments?: Comment[] }>;
  /** Absent for types Aha exposes no comment-create endpoint for. */
  write?: (id: string, body: string) => Promise<Comment>;
}

const TARGETS: CommentTarget[] = [
  {
    key: "feature",
    link: "feature",
    read: id => services.AhaService.getFeatureComments(id),
    write: (id, body) => services.AhaService.createFeatureComment(id, body)
  },
  {
    key: "idea",
    link: "idea",
    read: id => services.AhaService.getIdeaComments(id),
    write: (id, body) => services.AhaService.createIdeaComment(id, body)
  },
  {
    key: "epic",
    link: "epic",
    read: id => services.AhaService.getEpicComments(id),
    write: (id, body) => services.AhaService.createEpicComment(id, body)
  },
  {
    key: "initiative",
    link: "initiative",
    read: id => services.AhaService.getInitiativeComments(id),
    write: (id, body) => services.AhaService.createInitiativeComment(id, body)
  },
  {
    key: "goal",
    link: "goal",
    read: id => services.AhaService.getGoalComments(id),
    write: (id, body) => services.AhaService.createGoalComment(id, body)
  },
  {
    key: "release",
    link: "release",
    read: id => services.AhaService.getReleaseComments(id),
    write: (id, body) => services.AhaService.createReleaseComment(id, body)
  },
  {
    key: "release_phase",
    link: "release-phase",
    read: id => services.AhaService.getReleasePhaseComments(id),
    write: (id, body) => services.AhaService.createReleasePhaseComment(id, body)
  },
  {
    key: "requirement",
    link: "requirement",
    read: id => services.AhaService.getRequirementComments(id),
    write: (id, body) => services.AhaService.createRequirementComment(id, body)
  },
  {
    key: "todo",
    link: "todo",
    read: id => services.AhaService.getTodoComments(id),
    write: (id, body) => services.AhaService.createTodoComment(id, body)
  },
  {
    // Aha's OpenAPI document has GET but no POST for a workspace's comments, so this one is
    // read-only rather than omitted - reading it is still useful.
    key: "product",
    link: "product",
    read: id => services.AhaService.getProductComments(id)
  }
];

const READABLE = TARGETS.map(t => t.key) as [string, ...string[]];
const WRITABLE = TARGETS.filter(t => t.write).map(t => t.key) as [string, ...string[]];

function target(key: string): CommentTarget {
  const found = TARGETS.find(t => t.key === key);
  // Unreachable through the tool - the enum rejects anything else before the handler runs.
  if (!found) throw new Error(`Unsupported record type: ${key}`);
  return found;
}

/** Aha comment bodies are HTML; a one-line preview is for a person skimming, not for parsing. */
function preview(body: unknown, limit = 100): string {
  if (typeof body !== "string") return "(no body)";
  const text = body
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text || "(empty)";
}

function authorOf(comment: Record<string, unknown>): string {
  const named = (value: unknown): string | undefined => {
    if (!value || typeof value !== "object") return undefined;
    const record = value as Record<string, unknown>;
    const name = record.name ?? record.email;
    return typeof name === "string" && name ? name : undefined;
  };

  return (
    named(comment.user) ??
    named(comment.idea_commenter_portal_user) ??
    named(comment.idea_commenter_idea_user) ??
    "unknown"
  );
}

/** Oldest first, so a conversation reads top to bottom. Undated comments sort last. */
function byCreatedAt(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const at = typeof a.created_at === "string" ? Date.parse(a.created_at) : NaN;
  const bt = typeof b.created_at === "string" ? Date.parse(b.created_at) : NaN;
  if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
  if (Number.isNaN(at)) return 1;
  if (Number.isNaN(bt)) return -1;
  return at - bt;
}

export function registerCommentTools(server: McpServer) {
  server.registerTool(
    "aha_list_comments",
    {
      title: "List comments",
      description:
        "Read the comments on an Aha.io record - feature, idea, epic, initiative, goal, " +
        "release, release phase, requirement, todo or product. For an idea this returns both " +
        "streams: internal comments and the ideas-portal conversation, which are separate " +
        "records in Aha, so a customer's own words arrive alongside internal discussion. " +
        "Every comment is labelled with its source ('internal' or 'portal') and, for portal " +
        "comments, its visibility. Returns the comments oldest first as structuredContent, a " +
        "summary listing author and an excerpt of each, and a link to the parent record.",
      inputSchema: {
        recordType: z
          .enum(READABLE)
          .describe(
            "Type of record to read comments from. Only 'idea' has a portal comment stream."
          ),
        recordId: z
          .string()
          .min(1)
          .describe("Reference number (e.g. PRJ1-123) or internal id of the record."),
        includePortalComments: z
          .boolean()
          .optional()
          .describe(
            "Ideas only, default true. When true the ideas-portal conversation is read as " +
              "well as the internal comments. Set false to see internal comments alone - but " +
              "note that a portal reply from a customer will then be missing with no sign of it."
          )
      },
      outputSchema: commentListOutputSchema,
      annotations: {
        title: "List comments",
        readOnlyHint: true,
        openWorldHint: true
      }
    },
    async ({ recordType, recordId, includePortalComments }) => {
      const config = target(recordType);
      const wantsPortal = recordType === "idea" && includePortalComments !== false;

      try {
        const internal = await config.read(recordId);
        const comments: Record<string, unknown>[] = (internal.comments ?? []).map(comment => ({
          ...(comment as Record<string, unknown>),
          source: "internal" as const
        }));

        if (wantsPortal) {
          const portal = await services.AhaService.getIdeaPortalComments(recordId);
          for (const comment of portal.idea_comments ?? []) {
            comments.push({ ...(comment as Record<string, unknown>), source: "portal" as const });
          }
        }

        comments.sort(byCreatedAt);

        const payload = {
          record_type: recordType,
          record_id: recordId,
          comment_count: comments.length,
          includes_portal_comments: wantsPortal,
          comments
        };

        const lines = comments.map(comment => {
          const visibility =
            comment.source === "portal" && typeof comment.visibility === "string"
              ? ` [${comment.visibility}]`
              : "";
          return `- ${comment.source}${visibility} - ${authorOf(comment)}: ${preview(comment.body)}`;
        });

        const heading =
          comments.length === 0
            ? `No comments on ${recordType} ${recordId}` +
              (wantsPortal ? " (internal or ideas portal)." : ".")
            : `${comments.length} comment${comments.length === 1 ? "" : "s"} on ${recordType} ` +
              `${recordId}${wantsPortal ? ", internal and ideas portal" : ""}:`;

        return {
          content: [
            { type: "text" as const, text: [heading, ...lines].join("\n") },
            ...recordLinks(config.link, {}, recordId)
          ],
          structuredContent: payload
        };
      } catch (error) {
        log.error(`Failed to list comments for ${recordType} ${recordId}`, error as Error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing comments: ${describeAhaError(error, `${recordType} ${recordId}`)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "aha_create_comment",
    {
      title: "Add comment",
      description:
        "Add a comment to an Aha.io record - feature, idea, epic, initiative, goal, release, " +
        "release phase, requirement or todo. The comment is internal: visible to Aha.io users " +
        "and never shown in an ideas portal, including on an idea. To reply to a customer in " +
        "the ideas portal, use aha_create_idea_portal_comment instead. Returns the created " +
        "comment and a link to the record it was added to.",
      inputSchema: {
        recordType: z.enum(WRITABLE).describe("Type of record to comment on."),
        recordId: z
          .string()
          .min(1)
          .describe("Reference number (e.g. PRJ1-123) or internal id of the record."),
        body: z
          .string()
          .min(1)
          .describe("Comment body. HTML is accepted, e.g. <p>text</p>; plain text also works.")
      },
      outputSchema: commentOutputSchema,
      annotations: {
        title: "Add comment",
        readOnlyHint: false,
        destructiveHint: false,
        // A repeated call adds another comment rather than updating the first.
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ recordType, recordId, body }) => {
      const config = target(recordType);

      try {
        const comment = (await config.write!(recordId, body)) ?? {};
        const record = comment as unknown as Record<string, unknown>;

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Added internal comment to ${recordType} ${recordId}: ${preview(record.body ?? body)}`
            },
            ...recordLinks(config.link, {}, recordId)
          ],
          structuredContent: record
        };
      } catch (error) {
        log.error(`Failed to comment on ${recordType} ${recordId}`, error as Error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error adding comment: ${describeAhaError(error, `${recordType} ${recordId}`)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "aha_create_idea_portal_comment",
    {
      title: "Reply in ideas portal",
      description:
        "Comment on an idea in a way that can be seen outside Aha.io, in the ideas portal - " +
        "this is how you reply to a customer who submitted or commented on an idea. " +
        "visibility is required and decides the audience: 'public' shows the comment to every " +
        "portal user, 'employee_or_creator' restricts it to employees and the idea's creator. " +
        "Aha.io itself defaults to 'public', so nothing here is optional by design. For a note " +
        "that must stay inside Aha.io, use aha_create_comment. Returns the created comment and " +
        "a link to the idea.",
      inputSchema: {
        ideaId: z
          .string()
          .min(1)
          .describe("Reference number (e.g. PRJ1-I-7) or internal id of the idea."),
        body: z
          .string()
          .min(1)
          .describe("Comment body. HTML is accepted, e.g. <p>text</p>; plain text also works."),
        visibility: z
          .enum(["public", "employee_or_creator"])
          .describe(
            "Who can see this. 'public' means every ideas-portal user, i.e. customers. " +
              "'employee_or_creator' limits it to employees and whoever created the idea. " +
              "Required - do not guess which one the user meant."
          )
      },
      outputSchema: ideaCommentOutputSchema,
      annotations: {
        title: "Reply in ideas portal",
        readOnlyHint: false,
        // Not destructive - it adds a record and removes nothing - but it is the one write
        // here that a person outside the account can read.
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ ideaId, body, visibility }) => {
      try {
        const comment: IdeaComment =
          (await services.AhaService.createIdeaPortalComment(ideaId, body, visibility)) ?? {};
        const record = comment as unknown as Record<string, unknown>;

        const audience =
          visibility === "public"
            ? "visible to all ideas portal users"
            : "visible to employees and the idea's creator";

        return {
          content: [
            {
              type: "text" as const,
              text: `Added portal comment to idea ${ideaId} (${audience}): ${preview(record.body ?? body)}`
            },
            ...recordLinks("idea", {}, ideaId)
          ],
          structuredContent: record
        };
      } catch (error) {
        log.error(`Failed to add portal comment to idea ${ideaId}`, error as Error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error adding portal comment: ${describeAhaError(error, `idea ${ideaId}`)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
