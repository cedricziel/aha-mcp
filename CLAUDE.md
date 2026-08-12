# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `bun install` - Install dependencies
- `bun start` - Start the MCP server with stdio transport
- `bun run dev` - Start server in development mode with auto-reload (stdio)
- `bun run start:http` - Start the HTTP server
- `bun run dev:http` - Start HTTP server in development mode with auto-reload
- `bun build` - Build the stdio server for production
- `bun run build:http` - Build the HTTP server for production
- `bun run test` - Run the test suite. Prefer this over a bare `bun test`: it passes
  `--env-file=/dev/null`, because Bun auto-loads `.env` and a populated `AHA_TOKEN` makes the
  suite issue live API calls against a real Aha account.
- `bun run mcpb:validate` - Validate `manifest.json` against the MCP bundle schema
- `bun run mcpb:pack` - Build and pack the Claude Desktop extension to `dist/aha-mcp.mcpb`

### Notes for changing the build

- There are **no native dependencies**, and it should stay that way. The bundle produced by
  `bun build` runs on its own; nothing is resolved from `node_modules` at runtime. Adding a
  native module reintroduces the failure that made every packaged artifact crash on startup,
  because `bindings` resolves the compiled `.node` relative to `build/index.js`. Verify with
  `node build/index.js --help` after any build change.
- Do not run the tests with a `--preload` setup file. Forcing `MockAhaService` in-process
  breaks the unit tests that patch the real `AhaService`; the e2e tests get the mock via
  `AHA_TOKEN=test-token` in the spawned server's environment instead.
- `src/core/uri-template.ts` vendors the still-unmerged upstream fix from
  modelcontextprotocol/typescript-sdk#1083. Delete it once that lands, not before -
  without it, resource URIs carrying query parameters do not match.
- `manifest.json`'s tool list must match what the server actually registers. Regenerate it
  with `bun run manifest:sync`, which spawns the real server and copies `tools/list`
  verbatim, rather than editing by hand - `bun run manifest:check` fails without writing,
  for CI. Changing a tool's description in `src/core/tools.ts` and forgetting this leaves
  the desktop extension advertising the old behaviour. Keep prompts as
  `prompts_generated: true` - the schema requires a `text` field on any statically declared
  prompt, which the server generates at runtime instead.

### Search

Search goes through Aha's GraphQL API (`POST /api/v2/graphql`, `searchDocuments`), wrapped by
`src/core/services/aha-graphql.ts` and exposed as `aha_search`. GraphQL is undocumented in
Aha's REST docs and is not covered by `aha-js`, so `scripts/check-graphql.ts` exists to probe
what a given account and token can actually reach.

Behaviours measured against a live account, not documented upstream - keep the constants in
`aha-graphql.ts` in step if they change:

- `per` defaults to 20 and is clamped server-side to 10..200. Requests below 10 come back
  with 10, so the client raises them rather than promising something it will not deliver.
- `totalCount` saturates at 10000; surfaced as `total_count_is_capped`.
- `url` on a search hit is an app path (`/features/PRJ1-1`), not a URL. The client resolves
  it against the account host so `SearchHit.url` is always absolute and a client can open
  it. REST responses differ here - they already carry an absolute `url` (the web page) plus
  `resource` (the API endpoint), so nothing rewrites those.
- Argument and scoping errors arrive as GraphQL errors with an HTTP **200**. A genuine
  permission or licensing problem is an HTTP **403** - do not conflate them.
- Most other list queries (`goals`, `initiatives`, `keyResults`, ...) require a `filters`
  argument *and* a scoping id inside it; `filters: {}` is rejected.
- **There is no match-all query, and `*` is not one.** Alone it returns an arbitrary subset
  (4116 hits on an account where `APPO11Y*` by itself returned 7963); combined with
  `projectId` it returns **zero**, for every workspace tried. `searchDocuments` rejects a
  wildcard-only query rather than passing it on, because the empty result reads as an empty
  workspace and gets diagnosed as a broken `projectId` filter - which is exactly what
  happened while `aha_search`'s own description recommended that combination. The filter
  works: `projectId` plus a real term returns correctly scoped hits. Do not restore the
  match-all claim to the tool description, the README, or the blank-query error.
- `projectId` must be a **string**. A numeric id is not an error, it silently matches
  nothing - and real workspace ids exceed 2^53, so a JS number cannot hold one exactly
  anyway. `searchDocuments` coerces with `String()`.
- A search hit cannot carry per-type fields. `searchDocuments` returns a concrete
  `SearchDocument`, not a union, so `... on Feature { workflowStatus }` is rejected outright
  with *"Fragment on Feature can't be spread inside SearchDocument"*. Status, release
  membership and custom field values are only reachable per record - hence the `aha_get_*`
  tools. Do not try to enrich search hits through this query.

A previous local-cache implementation (SQLite plus a placeholder embedding that hashed
character codes through `Math.sin()`) was removed in favour of this. Do not reintroduce
client-side "semantic" ranking without a real embedding model.

### Comments

Comments live in `src/core/tools/comment-tools.ts` (`aha_list_comments`, `aha_create_comment`,
`aha_create_idea_portal_comment`) plus the `aha://comments/{type}/{id}` resources. Three
things here are not guessable from Aha's docs:

- **An idea has two comment streams, and they are disjoint.** `/ideas/{id}/comments` holds
  internal comments; `/ideas/{id}/idea_comments` holds the ideas-portal conversation, served
  by a different SDK class (`IdeaCommentsApi`). Measured on a live idea: one internal comment,
  two portal comments, **no overlapping ids**. The portal side is where a customer's own words
  are - on the idea probed, a portal user asking why their idea was rejected, and the reply.
  Reading only `/comments` therefore looks complete while dropping the half that matters for
  triage. `aha_list_comments` reads both for ideas and stamps each comment with `source`;
  `aha://comments/idea/{id}` and `aha://idea-comments/{id}` stay separate URIs so neither
  changes meaning. Do not merge them into one resource.
- **`visibility` reads and writes in different vocabularies.** A response carries a phrase
  ("Visible to all ideas portal users"); a create request takes `public` or
  `employee_or_creator`. One cannot be fed back as the other, so nothing maps between them.
- **`visibility` is a required argument on `aha_create_idea_portal_comment`.** Aha defaults it
  to `public`, which means a caller that omits the field publishes to customers by accident.
  Keep it required, and keep the portal write a separate tool from `aha_create_comment` so a
  host can gate the customer-facing one on its own.

Two smaller notes. `POST /ideas/{id}/comments` is documented as creating an *internal*
comment, so `aha_create_comment` on an idea cannot reach the portal - that is why the tool
says "internal" in its own output. And Aha's spec has GET but no POST for a workspace's
comments, so `product` is readable but not writable; the `TARGETS` table in `comment-tools.ts`
encodes that by having no `write` for it, rather than failing at call time.

The SDK's `IdeacommentsPostRequest` model captured only `spam`, because aha-js 2.0.0 is
generated from recorded test responses. `createIdeaPortalComment` casts the documented
`{ idea_comment: { body, visibility } }` body onto it; if a regenerated SDK types that
properly, drop the cast.
### Goals and key results (OKRs)

`src/core/tools/goal-tools.ts` holds the writers; the two readers live with the others in
`record-tools.ts`. Goals are Aha's objectives and key results the measurable half, so both
have to be writable for a quarterly OKR loop to happen through this server at all - before
these, a goal was readable only as a resource and a key result was not reachable in any form.

Measured against a live account, not taken from `@cedricziel/aha-js`' fixture-derived spec:

- **A goal has no top-level `workflow_status`.** Its status lives at
  `success_metric.workflow_status.name`, which is what the Aha UI shows. `goalOutputSchema`
  therefore does not describe one, and `stateDetail()` falls back to the success metric.
  Do not "fix" this by describing `workflow_status` on a goal.
- **A key result carries no `url` and no `resource`** - unlike every other record type here,
  and unlike the abbreviated copies embedded in `goal.key_results`, which do have a `url`.
  So a key result's summary line cannot end in a link, and `aha://key_result/{id}` is the
  only pointer a client can follow. That resource template is what makes `recordLinks()`
  legal for the type; it is not optional.
- **Goal creation and deletion are workspace-scoped**, `POST /products/{id}/goals` and
  `DELETE /products/{id}/goals/{id}`. There is no account-level route for either, which is
  why `aha_create_goal` and `aha_delete_goal` require a workspace id where the other creates
  and deletes here do not. Updates reach the record either way: `PUT /goals/{id}` is what
  aha-js was generated against and is the default, while `productId` selects Aha's
  documented `PUT /products/{id}/goals/{id}`. To check a route exists without writing
  anything, request it with id `0`: an API route Aha serves answers
  `{"error":"Record not found."}` as JSON, while one it does not serve answers with Aha's
  HTML 404 page. That is how `PUT /goals/{id}` and `PUT /key_results/{id}` were confirmed.
- **`workflow_status` is an object for a key result and a bare string for a goal.** The key
  result tools accept either and `AhaService.normalizeKeyResultPayload()` wraps a string,
  because a caller re-grading an OKR has a name in hand and one echoing a record it just read
  has the object.
- `GET /goals/{goal_id}/key_results` returns `{ key_results, pagination }`; the generated
  operation is typed as returning the single-record `{ key_result }` wrapper. `GoalsPostRequest`
  likewise omits `name`, which Aha's own documentation lists (and requires) - hence the
  pass-through payloads and casts at that boundary.
- `aha_list_key_results` emits one `resource_link` per key result, unlike `aha_search`, which
  emits none. The difference is coverage: every record in this result is the same type and has
  a resource template, so linking is complete rather than partial.

### Error handling

Aha's REST failures are mapped by `src/core/services/aha-errors.ts` rather than surfaced
raw. `aha-js` throws axios errors whose message is `Request failed with status code 403`,
which names neither what was refused nor why, and reads like a bug in this server.

- Tools call `describeAhaError(error)` in their catch branch. The existing per-tool prefix
  already names the operation, so the mapper only explains the status.
- Resources throw `toMcpError(error, uri.toString())`. A record the token cannot reach is
  `InvalidParams` (-32602), matching the SDK's own code for an unrecognised URI; only
  genuine server-side or unclassified failures stay `InternalError` (-32603). Letting a raw
  error escape produced -32603 for everything, which claims a server bug for what is
  usually a permissions problem.
- **404 must not be reported as "does not exist".** Aha returns 404 both for a missing
  record and for one the token cannot see, so the message says so. Do not tighten it.
- Errors this server raises itself (missing credentials and the like) pass through
  untouched - they already say what to do.
- Nothing retries. A 429 is reported with Aha's `retry_after` and the documented limits;
  whether to wait belongs to the caller.

## Runtime Configuration

The server supports runtime configuration through three key parameters:

### Configuration Parameters

- **Company**: Aha.io company subdomain (e.g., "mycompany" for mycompany.aha.io)
- **Token**: Aha.io API token for authentication
- **Mode**: Transport mode - "stdio" or "streamable-http"

### Configuration Sources (Priority Order)

1. **Environment Variables** (highest priority)
   - `AHA_COMPANY` - Company subdomain
   - `AHA_TOKEN` - API token
   - `MCP_TRANSPORT_MODE` - Transport mode (stdio, streamable-http)
   - `MCP_PORT` - Port for HTTP-based transports (default: 3001)
   - `MCP_HOST` - Host for HTTP-based transports (default: 0.0.0.0)

2. **Configuration File**
   - Located at `~/.aha-mcp-config.json`
   - Automatically created when using configuration tools
   - Token is obfuscated for basic security

3. **Defaults** (lowest priority)
   - Mode: "stdio"
   - Port: 3001
   - Host: "0.0.0.0"

### Command Line Usage

```bash
# Use configuration settings
aha-mcp

# Force stdio mode (default, for local MCP clients)
aha-mcp --mode stdio

# Force Streamable HTTP mode (recommended for remote/web clients)
aha-mcp --mode streamable-http

# Custom Streamable HTTP configuration
aha-mcp --mode streamable-http --port 3000 --host localhost

# Show help
aha-mcp --help
```

### MCP Configuration Tools

The server includes three MCP tools for runtime configuration:

1. **configure_server** - Update server configuration
   ```json
   {
     "company": "mycompany",
     "token": "your-api-token",
     "mode": "streamable-http",
     "port": 3000,
     "host": "localhost"
   }
   ```

2. **get_server_config** - View current configuration and validation status

3. **test_configuration** - Test Aha.io connection with current credentials

## Architecture

This is a Model Context Protocol (MCP) server that provides integration with Aha.io's API. The codebase follows a modular structure:

### Core Architecture

- **Entry Points**: Unified entry point (`src/index.ts`) supports both transport modes
- **Server Factory**: `src/server/server.ts` creates and configures the MCP server instance
- **Core Modules**: Split into tools, resources, prompts, and configuration in `src/core/`
- **Service Layer**: `src/core/services/` contains the Aha.io API integration
- **Configuration**: `src/core/config.ts` handles runtime configuration management

### Key Components

- **AhaService**: Singleton service class that wraps the `aha-js` library for REST interactions
- **AhaGraphQLClient**: `src/core/services/aha-graphql.ts`, for the GraphQL API that `aha-js`
  does not cover. Reads credentials via `AhaService.getCredentials()` so `configure_server`
  applies at runtime
- **ConfigService**: Manages runtime configuration with file persistence and validation
- **Tools**: 48 MCP tools (CRUD, single-record reads, comments, OKRs, search, health checks,
  configuration), none of which keep local state
- **Resources**: 40+ resource types for accessing Aha.io entities via URI schemes. Every
  registration carries `annotations` from `resourceAnnotations()`, and collection reads are
  rendered per a three-tier policy rather than uniform JSON - see "Resource output: rendering
  tiers and `resourceAnnotations`" below
- **Read tools vs read resources**: `src/core/tools/record-tools.ts` registers `aha_get_*`
  for feature, epic, idea, initiative, release, goal and key result, wrapping the same
  service getters the `aha://{type}/{id}` resources call. The duplication is deliberate and should stay.
  Surfacing resources to a model is optional for a client, and tool-only clients are common;
  on one of those this server was ~25 writers plus a search returning six fields, so an
  agent could set a feature's status but never read the status it was replacing. Reads must
  stay reachable as tools for every type that has a write tool - if you add writers for a
  new type, add its reader too
- **Prompts**: 17 workflow prompts. Twelve template a question; five (`idea_triage`,
  `release_readiness`, `feature_description_draft`, `quarterly_roadmap_review`,
  `customer_demand_rollup`) instead tell the agent which tools and resources to reach for,
  and in what order. Those five deliberately fetch nothing themselves, so a prompt cannot
  fail or stall on the network
- **Instructions**: `src/core/instructions.ts`, passed to `McpServer` and returned in the
  `initialize` response. The only always-on context the server gets - prompts need
  invoking and tool descriptions are per-tool - so it is where session-wide guidance
  lives: what Aha is, that `reference_num` rather than `id` is the identifier people
  recognise, and that records should be linked by their absolute `url`. It costs context
  in every session, so keep it to what a client cannot infer from the tool list, and treat
  it as guidance: clients differ in how prominently they surface it, and anything that
  must hold belongs in the data instead. `buildServerInstructions()` interpolates the
  configured company subdomain, which is fixed at `initialize` time - a later
  `configure_server` cannot revise instructions the client already holds, so never let
  anything depend on that host being current. Record `url`s always reflect live
  credentials.
- **Authentication**: Runtime configuration with environment variables and config file support

Tool, resource and prompt counts are also mirrored in `manifest.json` for the desktop
extension - regenerate that list with `bun run manifest:sync` rather than editing it by hand.

### Transport Layer

The server supports two transport modes from a unified entry point:

- **Stdio**: Primary mode for local MCP client integration (default)
- **Streamable HTTP**: Modern HTTP-based transport (recommended for remote/web clients)
  - Protocol version: 2025-06-18
  - Single `/mcp` endpoint for all communication
  - Supports both POST (client → server) and GET (server-sent event streaming)
  - Origin validation for security
  - Session management with cryptographic session IDs
  - Optional Bearer auth via `MCP_AUTH_TOKEN` (see `src/server/middleware/auth.ts`)

The legacy `sse` transport was removed. `--mode sse` and `MCP_TRANSPORT_MODE=sse` are mapped
to `streamable-http` with a warning by `normalizeTransportMode()` in `src/core/config.ts`, so
existing setups keep starting rather than failing. Do not reintroduce it: the SDK marks
`SSEServerTransport` as `@deprecated`, and the MCP spec deprecated it in 2025-03-26.

### Configuration Management

The server includes comprehensive configuration management:

- **Runtime Updates**: Configuration changes apply immediately without restart
- **Validation**: Input validation and Aha.io connection testing
- **Persistence**: JSON file storage in user's home directory
- **Security**: Token obfuscation and secure credential handling
- **Priority System**: Environment variables → config file → defaults

### Naming Convention

All MCP tools, resources, and prompts use underscore naming (e.g., `aha_list_features`) instead of hyphens for Cursor compatibility.

## MCP Best Practices

When working with this MCP server, follow these key principles from the Model Context Protocol specification:

### Tools

- Provide clear, descriptive names and descriptions for all tools
- Use JSON Schema with Zod for parameter validation
- Include proper error handling with meaningful error messages
- Return structured responses with appropriate content types
- Use annotations to describe tool behaviors and side effects

#### Tool annotations

Every tool is registered with an annotations argument, and the e2e suite fails if one is
missing. Conventions used here:

- `title` is a short human-readable label for client UIs.
- `readOnlyHint` is true only for tools that never write: `aha_search`, `aha_list_comments`,
  the five `aha_get_*` readers, `server_status`, `get_server_config`, `server_health_check`,
  `test_configuration`.
- `destructiveHint` and `idempotentHint` are **omitted** when `readOnlyHint` is true - the
  spec only gives them meaning for writers.
- `destructiveHint: true` covers the deletes plus the two PUT endpoints that replace a whole
  collection: `aha_update_feature_tags` and `aha_associate_feature_with_goals` drop anything
  left out of the request.
- `openWorldHint: true` for anything that reaches Aha.io. That includes
  `server_health_check`, which calls `/me` when credentials are configured.
- `idempotentHint` is false for the `create_*` tools (a repeated call creates another record)
  and true for updates and associations.

Tools carry a display title in **both** spec locations: top-level `title` (the current
field) and `annotations.title` (what pre-2025-06-18 clients read, and what the spec gives
precedence over `name`). They must stay identical; the e2e suite asserts it.

#### Tool output: `outputSchema` and `structuredContent`

Every tool declares an `outputSchema` and returns `structuredContent`. Schemas live in
`src/core/tool-output.ts`. Two rules there are load-bearing:

- **Anything wrapping an Aha record uses `z.looseObject`.** A raw Zod shape converts to
  `additionalProperties: false`, and the SDK *client* rejects a result carrying keys the
  schema does not list - which would break every record-returning tool on the first field
  Aha adds. Payloads the server builds itself (deletions, search, the server/config tools)
  are closed objects.
- **Only describe fields Aha reliably returns, permissively typed.** The server validates
  its own `structuredContent` and turns a mismatch into a protocol error, so a wrong guess
  about a field's type fails the call rather than degrading. Undescribed fields still reach
  the client verbatim.

`structuredContent` is always the record itself, never Aha's wrapper: `unwrapRecord()`
flattens the `{ idea: ... }` / `{ initiative: ... }` responses so one contract covers every
record type. A response with no body becomes `{}` - every record field is optional, whereas
a missing `structuredContent` fails output validation and sinks the call.

Tools that touch a single record also return a `resource_link` to its `aha://` URI via
`recordLinks()`, so a client can re-read current state instead of trusting the point-in-time
copy. No identifier, no link: a link to an unreadable URI is worse than none. Each link sets
`title` as well as `name` - hosts display `title` in preference - plus
`annotations.audience`, `priority: 1` and, when Aha's `updated_at` is plainly Zulu ISO 8601,
`lastModified`. The timestamp guard is deliberate: the SDK types that annotation as
`z.iso.datetime()`, which rejects a numeric offset, and a rejected annotation fails the whole
call where an omitted one costs only a hint.

`aha_search` deliberately emits **no** `resource_link`s. `recordLinks()` can only build URIs
for the five types with a single-record template in `resources.ts`, while search returns a
dozen or more - so linking would cover some hits and silently skip others in the same result
set, for no reason a client could see. Its hits already carry an absolute `url`, and `perPage`
goes to 200, so the alternative was up to 200 content blocks of partial coverage. Reconsider
only if the missing record types gain resource templates.

**The text block is a one-line summary, not a copy of the record.** `recordSummary()` builds
`Updated feature PRJ1-123 "Name" - https://...`; `aha_search` renders its hits as a markdown
link list. This block used to be the payload re-serialised with `JSON.stringify(x, null, 2)`,
which duplicated `structuredContent` verbatim - double the tokens, and nothing a client could
present as anything but a blob. The record still travels in `structuredContent` and the
`resource_link` is the durable pointer, so the text block's job is to say what happened in a
form a person and a model can both read. Building the search links server-side also keeps the
model from re-emitting - and mangling - URLs it only ever needed to pass through.

Tool descriptions state what comes back ("Returns the updated feature and a link to it").
Host-side rendering is decided by a model reading tool contracts, so a description that names
its output is the cheapest lever this server has over how a result is presented.

#### Tool errors

Failures return `isError: true` with a plain-text message, never a success-shaped result
whose body says `success: false` - clients render the latter as a successful call. Output
validation is skipped for `isError` results at both ends, which is what lets a tool with an
`outputSchema` report a failure at all.

#### Tool rate limiting

`src/core/rate-limit.ts` wraps `server.registerTool` so every tool spends a token from a
process-wide bucket first; refusals come back as `isError` results naming the seconds to
wait. It is installed in `startServer()` **before** any registration - tools registered
earlier would not be covered. The bucket is deliberately global rather than per-session:
what it protects is Aha's API, which all sessions share. Default 120/minute, set
`MCP_TOOL_RATE_LIMIT_PER_MINUTE` to change it or `0` to disable.

#### Schema dialects

Input and output schemas are advertised as draft-07, because `toJsonSchemaCompat` in the
SDK converts Zod with a hardcoded `draft-7` target and never passes `target` for tools. The
spec permits an explicit dialect and only *recommends* 2020-12, so this conforms; it changes
when the SDK lets the target through, not before. Zero-argument tools use
`z.strictObject({}).optional()` and emit no `$schema`, so they default to 2020-12 - and,
unlike the raw `{}` shape they replaced, they accept a `tools/call` with `arguments` omitted
entirely, which the spec allows. An e2e test pins the dialects so an SDK upgrade surfaces
here rather than in a client.

### Resources

- Use unique URIs for resource identification (e.g., `aha://idea/{id}`)
- Implement proper resource discovery through list/read patterns
- Validate resource access and handle missing resources gracefully
- Support both text and binary content types as needed

#### Resource output: rendering tiers and `resourceAnnotations`

Every one of the 60 `registerResource` calls now attaches `annotations` from
`resourceAnnotations()` (`src/core/resource-output.ts`), and collection reads no longer come
back as one uniform `JSON.stringify(x, null, 2)` with `mimeType: "application/json"`. This is
the resource-side counterpart to "Tool output" above - same motivation, opposite constraint,
covered separately below.

Collections are rendered per record type, decided against what the live Aha list endpoint
actually returns rather than the permissive `aha-types.ts` interfaces (those describe every
field a record can carry across every endpoint that returns one, not what a specific list
endpoint populates):

- **Tier 1** (11 registrations - `features`, `epics`, `users`, `release_features`,
  `release_epics`, `goal_epics`, `initiative_epics`, `me_assigned_records`,
  `idea_organizations`): `renderCollection()`, a markdown link list, `text/markdown`. These
  endpoints return only identity fields. Verified against a live account:
  `/products/{id}/features` returns `created_at, id, name, product_id, reference_num,
  resource, url` - no `description`, no `workflow_status`, no `assigned_to_user`, no
  `progress`, no `due_date`. A link list is near-lossless for that shape.
- **Tier 2** (6 registrations - `ideas`, `product_releases`, `products`): `renderTable()`, a
  markdown table, `text/markdown`. These carry a handful of real scalar columns beyond
  identity - ideas add `description` and `workflow_status`, releases add `start_date`,
  `release_date`, `owner` - enough to be worth a column, not enough to need the nested
  structure JSON alone can carry.
- **Tier 3** (26 registrations - all 11 comment resources, `goals`, `initiatives`,
  `competitors`, `todos`, `endorsements`, `votes`, `custom_fields`, `custom_field_options`,
  `release_phases`, `strategic_models`, `me_pending_tasks`, `goal_key_results`): JSON kept
  unchanged, annotations added. Goals nest `features`/`initiatives`/`key_results`/`releases`
  arrays that a flat table or a link list would either flatten away or drop outright.
  `goal_key_results` lands here by the same conservative default, not by measurement: the
  live account has no goal with any key results and `/goals/{id}/key_results` returns an
  empty array, so the list endpoint's shape has never been checked against a real payload -
  see the code comment at that registration if a real payload becomes available to verify
  against.
- **Single-record** (17 registrations, `aha://feature/{id}` and siblings): JSON kept
  unconditionally, `resourceAnnotations(record)` passed so a fetched record's `updated_at`
  becomes `lastModified` the same way `recordLinks()` does for tools. Someone reading one
  specific record wants the data, not a summary of it, so tiering never applies here. This
  set includes `key_result`, which carries no `url` of its own - the `aha://key_result/{id}`
  URI is the only stable pointer to one.

**Two rules in this scheme must not be undone:**

- **A record type whose interface does not reliably carry `reference_num` or `name` cannot be
  tier 1.** `renderCollection` labels every record by one of those two fields and silently
  drops any record with neither - dropped, not rendered with a blank label. Check the actual
  interface in `src/core/types/aha-types.ts` before assigning tier 1; do not assume a type
  has one just because most Aha records do.
- **Comments are tier 3, permanently.** Aha's `Comment` carries only `id`, `body`, `url` -
  never `reference_num` or `name`. Routing comments through `renderCollection` would silently
  delete every comment body: the eleven comment resources (the nine `*_comments` resources
  plus `aha_idea_portal_comments`, whose `aha://idea-comments/{id}` URI does not follow that
  naming pattern but shares the same `Comment` shape) would render as a heading and a count,
  with the one thing anyone reading a comment wants gone. The body *is* the payload;
  there is nothing to index by. If a future type has this shape, the fix is routing it to
  tier 3, never loosening `renderCollection` to emit unlabelled bullets - a bullet with no
  label is worse than no bullet, and a bullet with a truncated body is worse than JSON.

**This is not the same move as the tool-side text-block change above.** Trimming a tool's
text block to a one-line summary was safe because the record still travelled in
`structuredContent` - the client never lost the data, only a duplicate copy of it. Resources
have no `structuredContent` and no `outputSchema`; the content block is the only channel a
resource read has. Dropping JSON there is data loss, not de-duplication. That asymmetry is
the entire reason tier 3 exists, and it is why the default for a collection whose shape has
not been checked against a real response is tier 3, never tier 1 or 2: a conservative miss
here costs tokens, an aggressive miss destroys data.

**The tiering was validated, not guessed, for the types it covers.** An A/B benchmark
(Claude Sonnet, 5 repeats per cell, 89 runs total) compared raw JSON against the tier-2 table
rendering: ideas scored 30/30 correct both ways, at a median cost of $0.0428 (JSON) versus
$0.0377 (table); releases scored 12/15 versus 11/14 correct, at $0.1946 versus $0.0433.
Correctness was statistically indistinguishable between the two renderings, the token saving
is real and largest on the fattest record types, and a drilldown question (one that needs a
field the table omits) costs the table an extra resource read that erases its advantage for
that access pattern - so the table is a net win for scanning, not for every workload. Goals
was **not** benchmarked; its tier-3 placement rests on the nested-array reasoning above, not
on measurement. `scripts/bench/` exists to re-run this comparison if a renderer changes -
see that directory's own README for how, not this file.

`resourceAnnotations()` re-implements its own `isoTimestamp` Zulu-timestamp guard rather than
importing the equivalent one from `tool-output.ts`, and that duplication is deliberate, not
an oversight to clean up: the reasoning behind the guard belongs to whichever module owns it,
and the SDK types `lastModified` as `z.iso.datetime()`, which rejects a non-Zulu offset and
fails the whole read if a rejected annotation slips through. Four duplicated lines here beat
a shared export whose only reason to exist would be being called from two places.

### Security & Validation

- Validate all inputs rigorously using Zod schemas
- Implement proper authentication via environment variables
- Rate limit tool invocations (`src/core/rate-limit.ts`), which the tools spec requires
- Sanitize user inputs before API calls
- Handle errors without exposing internal implementation details

### Development Guidelines

- Use the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`)
- Follow JSON-RPC 2.0 message format for all communications
- Support multiple transports (stdio, streamable-http) for flexibility
- Log usage appropriately for debugging and monitoring
- Design for human oversight and control of AI interactions

## Transport Migration

`sse` was removed after being deprecated in MCP spec 2025-03-26. If you have an old
configuration:

```bash
export MCP_TRANSPORT_MODE=streamable-http   # instead of sse
```

The server accepts `sse` and warns, mapping it to `streamable-http`. If you were talking HTTP
directly, the two SSE endpoints (`/sse` for GET, `/messages` for POST) are replaced by a
single `/mcp` endpoint handling both, with a `MCP-Protocol-Version: 2025-06-18` header and
session ids taken from the response headers.
