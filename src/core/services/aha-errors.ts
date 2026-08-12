import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Turning Aha's REST failures into something a caller can act on.
 *
 * The REST paths used to surface axios' own wording - `Request failed with status code 403` -
 * which says nothing about what was refused or why, and is indistinguishable from a bug in
 * this server. The GraphQL client in `aha-graphql.ts` has always mapped its statuses; this is
 * the same courtesy for the 31 tools and 40+ resources that go through `aha-js`.
 *
 * Deliberately no retrying here. Aha's limits are 300 requests/minute and 20/second and a 429
 * carries `retry_after`, but whether to wait or fail belongs to the caller, so a 429 is
 * reported with the header's value rather than slept on.
 */

/** Aha's documented rate limits, worth stating when one is hit. */
const RATE_LIMITS = "300 requests per minute and 20 per second";

interface AxiosLikeError {
  isAxiosError?: boolean;
  response?: { status?: number; headers?: Record<string, unknown> };
  message?: string;
}

function asAxiosLike(error: unknown): AxiosLikeError | null {
  return error && typeof error === "object" ? (error as AxiosLikeError) : null;
}

/** HTTP status of a failed Aha call, or null if the error is not an HTTP response. */
export function statusOf(error: unknown): number | null {
  const status = asAxiosLike(error)?.response?.status;
  return typeof status === "number" ? status : null;
}

/** The `retry_after` Aha sends with a 429, if it sent one. */
export function retryAfterOf(error: unknown): string | null {
  const headers = asAxiosLike(error)?.response?.headers;
  if (!headers) return null;

  const value = headers["retry_after"] ?? headers["retry-after"];
  return value === undefined || value === null ? null : String(value);
}

/** True when the request never got a response at all, rather than an error response. */
function isTransportFailure(error: unknown): boolean {
  const candidate = asAxiosLike(error);
  return candidate?.isAxiosError === true && !candidate.response;
}

function fallbackMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Explain a failed Aha call.
 *
 * `subject` names what was being reached for - a resource URI, or a record reference - so the
 * message identifies the thing that failed rather than just the fact that something did.
 *
 * Errors this server raises itself (missing credentials, for instance) already say something
 * useful, so they are passed through untouched.
 */
export function describeAhaError(error: unknown, subject?: string): string {
  const status = statusOf(error);
  const what = subject ? `${subject}` : "the requested record";

  switch (status) {
    case 400:
      return `Aha.io rejected the request as invalid (HTTP 400): ${fallbackMessage(error)}`;

    case 401:
      return (
        "Aha.io rejected the credentials (HTTP 401). The token may be wrong, expired or " +
        "revoked - check AHA_TOKEN, or run configure_server."
      );

    case 403:
      return (
        `Aha.io denied access to ${what} (HTTP 403). This token may not have permission for ` +
        "it, or the account may not include the product it belongs to. A 403 is a genuine " +
        "permission problem, not a bad request."
      );

    case 404: {
      // Worth spelling out: Aha does not distinguish these, so neither can this server.
      return (
        `${what} was not found (HTTP 404). Aha returns 404 both for a record that does not ` +
        "exist and for one this token cannot see, so it may exist in a workspace you do not " +
        "have access to."
      );
    }

    case 422:
      return (
        `Aha.io would not accept the change to ${what} (HTTP 422). A field is likely invalid ` +
        `for its type, or a required one is missing: ${fallbackMessage(error)}`
      );

    case 429: {
      const retryAfter = retryAfterOf(error);
      return (
        "Aha.io rate limit reached (HTTP 429)" +
        (retryAfter ? `; retry after ${retryAfter}` : "") +
        `. The limits are ${RATE_LIMITS}.`
      );
    }
  }

  if (status !== null && status >= 500) {
    return (
      `Aha.io returned a server error (HTTP ${status}) for ${what}. This is on Aha's side ` +
      "rather than in the request; retrying later is usually the fix."
    );
  }

  if (isTransportFailure(error)) {
    return (
      `Could not reach Aha.io: ${fallbackMessage(error)}. Check network access and that the ` +
      "configured company subdomain is right."
    );
  }

  return fallbackMessage(error);
}

/**
 * The same explanation as an `McpError`, for resources.
 *
 * Resources used to let a raw error escape, which the SDK reported as `-32603` Internal
 * error - wrong for a record that simply is not available to this token, and inconsistent
 * with the SDK's own `-32602` for an unrecognised URI. A reference the caller cannot use is
 * `InvalidParams`; anything genuinely on Aha's side or unclassified stays `InternalError`.
 */
export function toMcpError(error: unknown, subject?: string): McpError {
  if (error instanceof McpError) return error;

  const status = statusOf(error);
  const code =
    status === 403 || status === 404 || status === 400
      ? ErrorCode.InvalidParams
      : ErrorCode.InternalError;

  return new McpError(code, describeAhaError(error, subject));
}
