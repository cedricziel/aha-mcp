import { ResourceTemplate as SdkResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UriTemplate, type Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";

/**
 * Query-parameter-aware RFC 6570 matching for MCP resource templates.
 *
 * The upstream SDK's `UriTemplate.match()` builds a single anchored regex over the
 * whole template, which means a `{?a,b,c}` expression only matches when every
 * parameter is present, in the template's exact order, unencoded. Resources such as
 * `aha://features{?query,updatedSince,tag,assignedToUser,page,perPage}` are therefore
 * unreachable in practice - `aha://features?page=1` fails to match.
 *
 * The fix lives in https://github.com/modelcontextprotocol/typescript-sdk/pull/1083,
 * which is still open. This class ports that logic so we can depend on the released
 * SDK instead of a fork of it. Remove this module once PR #1083 ships upstream.
 *
 * Behaviour, matching PR #1083:
 * - query parameters are optional (omitted ones resolve to `''`)
 * - query parameters may appear in any order
 * - percent-encoded keys and values are decoded
 */
export class QueryAwareUriTemplate extends UriTemplate {
  override match(uri: string): Variables | null {
    const queryIndex = uri.indexOf("?");
    const pathPart = queryIndex === -1 ? uri : uri.slice(0, queryIndex);
    const queryPart = queryIndex === -1 ? "" : uri.slice(queryIndex + 1);

    const pathNames: string[] = [];
    const queryNames: Array<{ name: string; exploded: boolean }> = [];
    let pattern = "^";

    for (const part of this.templateParts()) {
      if (typeof part === "string") {
        pattern += escapeRegExp(part);
        continue;
      }

      if (part.operator === "?" || part.operator === "&") {
        // Matched out of the query string below rather than positionally.
        for (const name of part.names) {
          queryNames.push({ name, exploded: part.exploded });
        }
        continue;
      }

      pattern += pathPartToRegExp(part);
      pathNames.push(part.name);
    }

    // A concrete URI may carry query parameters the template does not name.
    pattern += "(?:\\?.*)?$";

    const match = pathPart.match(new RegExp(pattern));
    if (!match) return null;

    const result: Variables = {};

    pathNames.forEach((name, index) => {
      const value = match[index + 1];
      const cleanName = name.replace("*", "");
      result[cleanName] = value?.includes(",") ? value.split(",") : value;
    });

    if (queryNames.length > 0) {
      const queryParams = parseQuery(queryPart);
      for (const { name, exploded } of queryNames) {
        const cleanName = name.replace("*", "");
        const value = queryParams.get(cleanName);
        if (value === undefined) {
          result[cleanName] = "";
        } else if (exploded && value.includes(",")) {
          result[cleanName] = value.split(",");
        } else {
          result[cleanName] = value;
        }
      }
    }

    return result;
  }

  /**
   * The parsed template. `parts` is private to the SDK, so reach for it once here
   * and fail loudly if a future SDK release changes the shape.
   */
  private templateParts(): TemplatePart[] {
    const parts = (this as unknown as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) {
      throw new Error(
        "QueryAwareUriTemplate: UriTemplate internals changed; this shim needs updating " +
          "(check whether modelcontextprotocol/typescript-sdk#1083 has landed)."
      );
    }
    return parts as TemplatePart[];
  }
}

/**
 * Drop-in replacement for the SDK's `ResourceTemplate` that matches query
 * parameters as described on {@link QueryAwareUriTemplate}.
 */
export class ResourceTemplate extends SdkResourceTemplate {
  constructor(
    uriTemplate: string | UriTemplate,
    callbacks: ConstructorParameters<typeof SdkResourceTemplate>[1]
  ) {
    super(
      typeof uriTemplate === "string" ? new QueryAwareUriTemplate(uriTemplate) : uriTemplate,
      callbacks
    );
  }
}

interface TemplatePart {
  name: string;
  operator: string;
  names: string[];
  exploded: boolean;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathPartToRegExp(part: TemplatePart): string {
  switch (part.operator) {
    case "":
      return part.exploded ? "([^/]+(?:,[^/]+)*)" : "([^/,]+)";
    case "+":
    case "#":
      return "(.+)";
    case ".":
      return "\\.([^/,]+)";
    case "/":
      return "/" + (part.exploded ? "([^/]+(?:,[^/]+)*)" : "([^/,]+)");
    default:
      return "([^/]+)";
  }
}

function parseQuery(queryPart: string): Map<string, string> {
  const params = new Map<string, string>();
  if (!queryPart) return params;

  for (const pair of queryPart.split("&")) {
    const equalIndex = pair.indexOf("=");
    if (equalIndex === -1) continue;
    params.set(
      safeDecode(pair.slice(0, equalIndex)),
      safeDecode(pair.slice(equalIndex + 1))
    );
  }
  return params;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // Malformed percent-encoding: keep the raw value rather than failing the match.
    return value;
  }
}
