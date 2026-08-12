import * as services from "./services/index.js";
import { ahaGraphQLClient, type AhaGraphQLClient } from "./services/aha-graphql.js";
import { log } from "./logger.js";

/**
 * Autocompletion for prompt arguments that name an Aha record.
 *
 * Prompts are user-controlled, so someone is typing these by hand. Without completion,
 * `product_id` and `feature_id` require knowing `ADAPTTELE` or `FEO11Y-134` from memory,
 * which nobody does past their own team's workspace.
 *
 * A completer never throws. A picker that errors is worse than one that offers nothing, and
 * these run against the network on a keystroke, so a rate limit or an expired token has to
 * degrade to an empty list.
 */

/** The response caps at 100; stay well under, since a long list is not browsable anyway. */
const MAX_COMPLETIONS = 50;

/** Workspaces fetched for `product_id` / `product_name` completion. */
const PRODUCT_PAGE_SIZE = 200;

/** Long enough that typing does not refetch per keystroke, short enough to notice new workspaces. */
const PRODUCT_CACHE_MS = 60_000;

/** Reference-number search results per keystroke. Aha allows 20 requests/second. */
const SEARCH_PAGE_SIZE = 25;

export interface Product {
  reference_prefix?: string;
  name?: string;
}

export interface RecordHit {
  name: string | null;
  url: string;
}

/**
 * Where completions get their data. Injectable so tests do not need an account, and so a
 * completer can be exercised without a live token.
 */
export interface CompletionSources {
  listProducts(): Promise<Product[]>;
  searchRecords(searchableType: string, query: string): Promise<RecordHit[]>;
}

export function defaultCompletionSources(
  graphQLClient: AhaGraphQLClient = ahaGraphQLClient
): CompletionSources {
  let cached: { at: number; products: Product[] } | null = null;

  return {
    async listProducts() {
      // Cached because every keystroke in a workspace field would otherwise be a request,
      // and the set of workspaces changes on the order of weeks.
      if (cached && Date.now() - cached.at < PRODUCT_CACHE_MS) return cached.products;

      // getAhaService() rather than AhaService, so a client connected against the mock gets
      // completions too instead of silently empty lists.
      const response: any = await services
        .getAhaService()
        .listProducts(undefined, 1, PRODUCT_PAGE_SIZE);
      const products: Product[] = response?.products ?? [];
      cached = { at: Date.now(), products };
      return products;
    },

    async searchRecords(searchableType: string, query: string) {
      const result = await graphQLClient.searchDocuments({
        query,
        searchableType: [searchableType],
        per: SEARCH_PAGE_SIZE
      });
      return result.results.map(hit => ({ name: hit.name, url: hit.url }));
    }
  };
}

/** Case-insensitive substring match, which is what someone half-remembering a name needs. */
function matches(candidate: string, typed: string): boolean {
  return candidate.toLowerCase().includes(typed.toLowerCase());
}

/**
 * The reference number is the last path segment of a record's URL -
 * `https://acme.aha.io/features/PRJ1-1` yields `PRJ1-1`.
 *
 * Aha's search results carry no `referenceNum` field, and the numeric `searchableId` is not
 * what a prompt argument wants, so this is the only route to the identifier a person uses.
 */
export function referenceNumberFromUrl(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)].slice(0, MAX_COMPLETIONS);
}

/**
 * Put reference numbers that actually start with what was typed first.
 *
 * Aha tokenises the query, so `FEO11Y-13*` also matches `FEO11Y-2` and `FEO11Y-53`. Those
 * are worth keeping - the same search is what makes typing a *name* work - but someone
 * halfway through a reference number should see it at the top rather than fifth.
 */
function prefixMatchesFirst(references: string[], typed: string): string[] {
  const needle = typed.toUpperCase();
  const starts: string[] = [];
  const rest: string[] = [];

  for (const reference of references) {
    (reference.toUpperCase().startsWith(needle) ? starts : rest).push(reference);
  }
  return [...starts, ...rest];
}

/**
 * Complete a workspace by its reference prefix (`ADAPTTELE`) or its name.
 *
 * Both are offered whichever field is being completed: someone who knows the name but not
 * the prefix is the whole reason this exists. `by` decides what gets inserted.
 */
export function completeProduct(
  by: "reference_prefix" | "name",
  sources: CompletionSources = defaultCompletionSources()
) {
  return async (value: string | undefined): Promise<string[]> => {
    try {
      const products = await sources.listProducts();
      const typed = (value ?? "").trim();

      const hits = products.filter(product => {
        if (!typed) return true;
        return (
          (product.reference_prefix && matches(product.reference_prefix, typed)) ||
          (product.name && matches(product.name, typed))
        );
      });

      return unique(hits.map(product => product[by]).filter((v): v is string => !!v));
    } catch (error) {
      log.error("Product completion failed", error as Error, { operation: "completeProduct", by });
      return [];
    }
  };
}

/**
 * Complete a record reference number by searching for what has been typed so far.
 *
 * Search matches reference numbers as well as names, verified against a live account:
 * `FEO11Y-134*` returns that feature first. An empty value returns nothing rather than a
 * wildcard search - the first 25 records of an arbitrary 10000 are not a useful offer, and
 * this way opening the field costs no request.
 */
export function completeRecordReference(
  searchableType: "Feature" | "Epic" | "Idea",
  sources: CompletionSources = defaultCompletionSources()
) {
  return async (value: string | undefined): Promise<string[]> => {
    const typed = (value ?? "").trim();
    if (!typed) return [];

    try {
      // Prefix matching, so a half-typed reference number still finds its record.
      const hits = await sources.searchRecords(searchableType, `${typed}*`);
      const references = hits
        .map(hit => referenceNumberFromUrl(hit.url))
        .filter((ref): ref is string => !!ref);

      return unique(prefixMatchesFirst(references, typed));
    } catch (error) {
      log.error("Record completion failed", error as Error, {
        operation: "completeRecordReference",
        searchable_type: searchableType
      });
      return [];
    }
  };
}

/**
 * Complete the last entry of a comma-separated list of reference numbers, keeping the
 * entries already typed.
 *
 * `idea_ids` takes `PRJ1-I-1,PRJ1-I-2`, so completing the whole value would replace what the
 * user has already listed.
 */
export function completeRecordReferenceList(
  searchableType: "Feature" | "Epic" | "Idea",
  sources: CompletionSources = defaultCompletionSources()
) {
  const completeOne = completeRecordReference(searchableType, sources);

  return async (value: string | undefined): Promise<string[]> => {
    const raw = value ?? "";
    const separator = raw.lastIndexOf(",");
    const prefix = separator === -1 ? "" : raw.slice(0, separator + 1);
    const partial = raw.slice(separator + 1);

    // Preserve the user's spacing after the comma, e.g. "A-1, " stays "A-1, ".
    const leadingSpace = partial.match(/^\s*/)![0];
    const completions = await completeOne(partial.trim());

    return completions.map(reference => `${prefix}${leadingSpace}${reference}`);
  };
}
