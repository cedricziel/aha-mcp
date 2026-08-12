import { AhaService } from './aha-service.js';
import { log } from '../logger.js';

/**
 * Minimal client for Aha.io's GraphQL API.
 *
 * Aha exposes GraphQL at POST /api/v2/graphql. It is not mentioned in the REST API
 * documentation and the generated aha-js client does not cover it, but it is the only place
 * Aha offers cross-entity search, and it takes the same Bearer token as the REST API.
 *
 * Deliberately hand-rolled over fetch: one query is not worth a GraphQL client dependency.
 */

/** Record types `searchDocuments` can return, from the live SearchableDocument union. */
export const SEARCHABLE_TYPES = [
  'BusinessModel',
  'Comment',
  'Competitor',
  'Epic',
  'Feature',
  'Goal',
  'Idea',
  'IdeaOrganization',
  'IdeaTheme',
  'IdeaUser',
  'Initiative',
  'KeyResult',
  'Page',
  'Persona',
  'Project',
  'Release',
  'ReleasePhase',
  'Requirement',
  'StrategicPositioning',
  'Task'
] as const;

export type SearchableType = (typeof SEARCHABLE_TYPES)[number];

/**
 * Page-size bounds, measured against the live API rather than documented anywhere:
 * omitting `per` yields 20, values below 10 are silently raised to 10, and values above
 * 200 are silently lowered to 200. Clamping here keeps the tool's contract honest - ask
 * for 4 and the server returns 10 regardless.
 */
export const MIN_PER_PAGE = 10;
export const MAX_PER_PAGE = 200;

/** `totalCount` saturates here rather than reporting the true total. */
export const TOTAL_COUNT_CEILING = 10000;

export interface SearchDocumentsParams {
  query: string;
  projectId?: string;
  searchableType?: string[];
  page?: number;
  per?: number;
}

export interface SearchHit {
  name: string | null;
  searchableType: string;
  searchableId: string | null;
  projectId: string | null;
  /**
   * Absolute link to the record in Aha, e.g. `https://acme.aha.io/features/PRJ1-1`.
   * `searchDocuments` returns an app path rather than a URL, so the client resolves it
   * against the account host before handing it out - see `toAbsoluteUrl`.
   */
  url: string;
  updatedAt: string;
  /**
   * The identifier people recognise - `IDEASVOC-I-9930`, `APPO11Y-43`. Null for the few
   * searchable types that have no reference number at all (ReleasePhase, IdeaUser, Project).
   *
   * This is not a field of `SearchDocument`; it comes from the record behind the hit, via
   * `searchable` - see `SEARCHABLE_ENRICHMENT`. Without it a hit's only human-readable
   * identifier is the tail of its `url` path, and an agent transcribing that drops the
   * workspace prefix: `I-9930` rather than `IDEASVOC-I-9930`, which every read then 404s on.
   */
  referenceNum: string | null;
  /** Aha score, for the types that are scorable. Null for the rest. */
  score: number | null;
  /** Ideas-portal vote count. Ideas only - null for every other type. */
  votes: number | null;
  /** Ideas-portal endorsement count. Ideas only - null for every other type. */
  endorsements: number | null;
}

/** The shape a node arrives in, before `searchable` is flattened into the hit. */
interface SearchNode {
  name: string | null;
  searchableType: string;
  searchableId: string | null;
  projectId: string | null;
  url: string;
  updatedAt: string;
  searchable?: {
    __typename?: string;
    referenceNum?: string | null;
    score?: number | null;
    votes?: number | null;
    numEndorsements?: number | null;
  } | null;
}

export interface SearchDocumentsResult {
  totalCount: number;
  /** True when totalCount hit the server's ceiling and the real total is higher. */
  totalCountIsCapped: boolean;
  currentPage: number;
  totalPages: number;
  isLastPage: boolean;
  results: SearchHit[];
}

/**
 * Per-record fields, reached through `searchable`.
 *
 * A fragment spread directly on `SearchDocument` is rejected outright - *"Fragment on Feature
 * can't be spread inside SearchDocument"* - which is why this server long reported that a hit
 * could not carry per-type fields at all. That is true of `SearchDocument`; it is not true of
 * its `searchable` field, which **is** a union (`SearchableDocument`, the same 20 members as
 * `SEARCHABLE_TYPES`). Fragments one level down are accepted, measured against a live account.
 *
 * Two things here are not guessable:
 *
 *  - **`ReferenceInterface` does not cover every type that has a `referenceNum`.** `Goal`,
 *    `Initiative` and `Task` declare the field without implementing the interface, and the
 *    miss is silent - the interface fragment simply returns null for them. Hence the three
 *    explicit fragments; drop them and initiative hits lose their reference number again.
 *  - **`votes` and `numEndorsements` exist on `Idea` only.** They are the ideas-portal demand
 *    signal, and the reason a search over ideas could not be ranked by demand before.
 */
const SEARCHABLE_ENRICHMENT = `
        searchable {
          __typename
          ... on ReferenceInterface { referenceNum }
          ... on Goal { referenceNum }
          ... on Initiative { referenceNum }
          ... on Task { referenceNum }
          ... on ScorableInterface { score }
          ... on Idea { votes numEndorsements }
        }`;

const searchDocumentsQuery = (enrichment: string) => `
  query SearchDocuments($filters: SearchDocumentFilters!, $page: Int, $per: Int) {
    searchDocuments(filters: $filters, page: $page, per: $per) {
      totalCount
      currentPage
      totalPages
      isLastPage
      nodes {
        name
        searchableId
        searchableType
        projectId
        url
        updatedAt${enrichment}
      }
    }
  }
`;

export const SEARCH_DOCUMENTS_QUERY = searchDocumentsQuery(SEARCHABLE_ENRICHMENT);

/**
 * The same query without the per-record fields, used only as a fallback.
 *
 * Aha validates the enriched query server-side and, rarely, gives up: one attempt in roughly
 * twenty came back HTTP 200 with `Timeout on validation of query` and no data, on a query
 * that succeeded 20 times either side of it - including at `per: 200`. Enrichment is worth
 * having but not worth failing a search over, so a GraphQL error retries once unenriched.
 * Argument errors (a bad `projectId`, an unknown filter) cost a second round trip and then
 * surface from the fallback, which is the right end of that trade.
 */
export const SEARCH_DOCUMENTS_QUERY_UNENRICHED = searchDocumentsQuery('');

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface AhaGraphQLOptions {
  /** Overridable for tests. */
  fetchImpl?: FetchLike;
  credentials?: () => { subdomain: string | null; accessToken: string | null };
}

export class AhaGraphQLClient {
  private readonly fetchImpl: FetchLike;
  private readonly credentials: () => { subdomain: string | null; accessToken: string | null };

  constructor(options: AhaGraphQLOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.credentials = options.credentials ?? (() => AhaService.getCredentials());
  }

  endpoint(): string {
    const { subdomain } = this.credentials();
    if (!subdomain) {
      throw new Error(
        'Aha.io company subdomain is not configured. Set AHA_COMPANY or call configure_server.'
      );
    }
    return `https://${subdomain}.aha.io/api/v2/graphql`;
  }

  /** The account's Aha host, e.g. `https://acme.aha.io`. */
  host(): string {
    return new URL(this.endpoint()).origin;
  }

  /**
   * `searchDocuments` returns app paths - `/features/PRJ1-1`, not a URL - which is no use to
   * a caller that wants to open the record. Resolve against the account host. Anything that
   * already carries a scheme is passed through, in case Aha starts returning absolute URLs.
   */
  private toAbsoluteUrl(url: string, host: string): string {
    if (!url) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
    return `${host}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  /**
   * Search across Aha records.
   *
   * Notes drawn from probing a live account:
   *  - the term matches record names and descriptions, and comment bodies surface as
   *    Comment hits pointing at their parent record
   *  - `*` suffix does prefix matching, `AND`/`OR`/`NOT` and "quoted phrases" are honoured
   *  - `projectId` constrains results to one workspace with no cross-workspace leakage
   *  - unrecognised `searchableType` values are not an error, they just match nothing
   *  - **there is no match-all query.** A bare `*` is not one: on its own it returns an
   *    arbitrary subset (4116 hits on an account where `APPO11Y*` alone returned 7963),
   *    and combined with `projectId` it returns **zero**, for every workspace tried. This
   *    is rejected below rather than passed through, because the empty result reads as an
   *    empty workspace and gets diagnosed as a broken `projectId` filter - which is what
   *    happened when the tool description recommended exactly that combination.
   *  - `projectId` must be a **string**. Passing the same id as a number is not an error;
   *    it silently matches nothing, so it is coerced below.
   */
  async searchDocuments(params: SearchDocumentsParams): Promise<SearchDocumentsResult> {
    const query = params.query?.trim();
    if (!query) {
      throw new Error(
        'A search query is required. Aha.io has no match-all query; search for a term, or ' +
          'use prefix matching such as "a*".'
      );
    }
    if (/^\*+$/.test(query)) {
      throw new Error(
        'Aha.io does not support "*" as a match-all query: on its own it returns an ' +
          'arbitrary subset of records, and scoped to a workspace it returns nothing at ' +
          'all. Search for a term instead - prefix matching ("a*"), a reference prefix ' +
          '("PRJ1*"), or several alternatives ("a* OR b* OR c*") - and narrow with ' +
          'recordTypes. To enumerate a workspace rather than search it, read its records ' +
          'through the list resources, e.g. aha://features or aha://ideas/{product_id}.'
      );
    }

    const filters: Record<string, unknown> = { query };
    if (params.projectId) filters.projectId = String(params.projectId);
    if (params.searchableType?.length) filters.searchableType = params.searchableType;

    const per = Math.min(Math.max(params.per ?? 20, MIN_PER_PAGE), MAX_PER_PAGE);
    const page = Math.max(params.page ?? 1, 1);

    type SearchResponse = {
      searchDocuments: {
        totalCount: number;
        currentPage: number;
        totalPages: number;
        isLastPage: boolean;
        nodes: SearchNode[];
      };
    };

    const variables = { filters, page, per };
    let data: SearchResponse;
    try {
      data = await this.request<SearchResponse>(SEARCH_DOCUMENTS_QUERY, variables);
    } catch (error) {
      // Only a GraphQL-level failure is worth a second attempt: a 401, a 403 or a transport
      // failure will not be fixed by asking for fewer fields. See
      // SEARCH_DOCUMENTS_QUERY_UNENRICHED for the failure this exists for.
      if (!(error instanceof Error) || !error.message.startsWith('Aha.io GraphQL error')) throw error;
      log.warn('Retrying search without per-record fields', { reason: error.message });
      data = await this.request<SearchResponse>(SEARCH_DOCUMENTS_QUERY_UNENRICHED, variables);
    }

    const page_ = data.searchDocuments;
    const host = this.host();
    return {
      totalCount: page_.totalCount,
      totalCountIsCapped: page_.totalCount >= TOTAL_COUNT_CEILING,
      currentPage: page_.currentPage,
      totalPages: page_.totalPages,
      isLastPage: page_.isLastPage,
      results: (page_.nodes ?? []).map(node => this.toHit(node, host))
    };
  }

  /**
   * Flatten `searchable` into the hit. The nesting is an artefact of how the field has to be
   * asked for, not something a caller should have to know about, and every enrichment field
   * becomes null rather than absent so one shape covers enriched and fallback responses alike.
   */
  private toHit(node: SearchNode, host: string): SearchHit {
    const { searchable, ...rest } = node;
    return {
      ...rest,
      url: this.toAbsoluteUrl(node.url, host),
      referenceNum: searchable?.referenceNum ?? null,
      score: searchable?.score ?? null,
      votes: searchable?.votes ?? null,
      endorsements: searchable?.numEndorsements ?? null
    };
  }

  private async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const { accessToken } = this.credentials();
    if (!accessToken) {
      throw new Error(
        'Aha.io API token is not configured. Set AHA_TOKEN or call configure_server.'
      );
    }

    const response = await this.fetchImpl(this.endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ query, variables })
    });

    if (response.status === 401) {
      throw new Error('Aha.io rejected the API token (HTTP 401). Check AHA_TOKEN.');
    }
    if (response.status === 403) {
      throw new Error(
        'Aha.io denied access to this GraphQL query (HTTP 403). The account may not include ' +
          'the required product.'
      );
    }

    type GraphQLBody = { data?: T; errors?: Array<{ message: string }> };
    let body: GraphQLBody | null = null;
    try {
      body = (await response.json()) as GraphQLBody;
    } catch {
      throw new Error(`Aha.io returned a non-JSON response (HTTP ${response.status}).`);
    }

    if (body?.errors?.length) {
      // Aha reports argument and scoping problems here with a 200 status.
      throw new Error(`Aha.io GraphQL error: ${body.errors.map(e => e.message).join('; ')}`);
    }
    if (!response.ok) {
      throw new Error(`Aha.io GraphQL request failed (HTTP ${response.status}).`);
    }
    if (!body?.data) {
      throw new Error('Aha.io GraphQL response contained no data.');
    }

    return body.data;
  }
}

export const ahaGraphQLClient = new AhaGraphQLClient();
