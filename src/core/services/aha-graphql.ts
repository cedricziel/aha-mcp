import { AhaService } from './aha-service.js';

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
  url: string;
  updatedAt: string;
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

const SEARCH_DOCUMENTS_QUERY = `
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
        updatedAt
      }
    }
  }
`;

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

  /**
   * Search across Aha records.
   *
   * Notes drawn from probing a live account:
   *  - the term matches record names and descriptions, and comment bodies surface as
   *    Comment hits pointing at their parent record
   *  - `*` suffix does prefix matching, `AND`/`OR`/`NOT` and "quoted phrases" are honoured
   *  - `projectId` constrains results to one workspace with no cross-workspace leakage
   *  - unrecognised `searchableType` values are not an error, they just match nothing
   */
  async searchDocuments(params: SearchDocumentsParams): Promise<SearchDocumentsResult> {
    const query = params.query?.trim();
    if (!query) {
      throw new Error('A search query is required. Use "*" to match everything.');
    }

    const filters: Record<string, unknown> = { query };
    if (params.projectId) filters.projectId = params.projectId;
    if (params.searchableType?.length) filters.searchableType = params.searchableType;

    const per = Math.min(Math.max(params.per ?? 20, MIN_PER_PAGE), MAX_PER_PAGE);
    const page = Math.max(params.page ?? 1, 1);

    const data = await this.request<{
      searchDocuments: {
        totalCount: number;
        currentPage: number;
        totalPages: number;
        isLastPage: boolean;
        nodes: SearchHit[];
      };
    }>(SEARCH_DOCUMENTS_QUERY, { filters, page, per });

    const page_ = data.searchDocuments;
    return {
      totalCount: page_.totalCount,
      totalCountIsCapped: page_.totalCount >= TOTAL_COUNT_CEILING,
      currentPage: page_.currentPage,
      totalPages: page_.totalPages,
      isLastPage: page_.isLastPage,
      results: page_.nodes ?? []
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
