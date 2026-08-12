import {
  Configuration,
  FeaturesApi,
  IdeasApi,
  UsersApi,
  EpicsApi,
  ProductsApi,
  InitiativesApi,
  CommentsApi,
  IdeaCommentsApi,
  GoalsApi,
  KeyResultsApi,
  ToDosApi,
  CompetitorsApi,
  RequirementsApi,
  ReleasePhasesApi,
  ReleasesApi,
  MeApi,
  StrategicModelsApi,
  IdeaOrganizationsApi,
  IdeaVotesApi,
  CustomFieldsApi
} from '@cedricziel/aha-js';
import type { IdeacommentsPostRequest } from '@cedricziel/aha-js';

import {
  Feature,
  FeaturesListResponse,
  Epic,
  EpicsListResponse,
  User,
  IdeaResponse,
  IdeasListResponse,
  InitiativeResponse,
  InitiativesListResponse,
  Product,
  ProductsListResponse,
  Comment,
  CommentsListResponse,
  IdeaComment,
  IdeaCommentsListResponse,
  IdeaCommentVisibility,
  GoalGetResponse,
  GoalsListResponse,
  GoalEpicsResponse,
  KeyResultsListResponse,
  KeyResultResponse,
  ReleaseGetResponse,
  ReleasesListResponse,
  ReleaseFeaturesResponse,
  ReleasePhase,
  ReleasePhasesListResponse,
  Competitor,
  CompetitorsListResponse,
  StrategicModel,
  StrategicModelsListResponse,
  IdeaOrganization,
  IdeaOrganizationsListResponse,
  Todo,
  TodosListResponse,
  Requirement,
  MeAssignedRecordsResponse,
  MePendingTasksResponse,
  IdeaEndorsementsResponse,
  IdeaVotesResponse,
  CustomFieldDefinitionsResponse,
  CustomFieldDefinition,
  CustomFieldOptionsResponse,
  RecordRef,
  Pagination
} from '../types/aha-types.js';

import { log } from '../logger.js';

/**
 * Service for interacting with the Aha.io API
 *
 * This is the only file in the repo that may import from `@cedricziel/aha-js`. The SDK is
 * generated per-operation from Aha's official OpenAPI document and renames every export on
 * each regeneration, so every method here maps one `*Api` call onto the stable domain types
 * in `../types/aha-types.js` at the boundary - see `aha-service.interface.ts` for why.
 */
export class AhaService {
  private static configuration: Configuration | null = null;
  private static featuresApi: FeaturesApi | null = null;
  private static ideasApi: IdeasApi | null = null;
  private static usersApi: UsersApi | null = null;
  private static epicsApi: EpicsApi | null = null;
  private static productsApi: ProductsApi | null = null;
  private static initiativesApi: InitiativesApi | null = null;
  private static commentsApi: CommentsApi | null = null;
  private static ideaCommentsApi: IdeaCommentsApi | null = null;
  private static goalsApi: GoalsApi | null = null;
  private static keyResultsApi: KeyResultsApi | null = null;
  private static todosApi: ToDosApi | null = null;
  private static competitorsApi: CompetitorsApi | null = null;
  private static requirementsApi: RequirementsApi | null = null;
  private static releasePhasesApi: ReleasePhasesApi | null = null;
  private static releasesApi: ReleasesApi | null = null;
  private static meApi: MeApi | null = null;
  private static strategicModelsApi: StrategicModelsApi | null = null;
  private static ideaOrganizationsApi: IdeaOrganizationsApi | null = null;
  private static ideaVotesApi: IdeaVotesApi | null = null;
  private static customFieldsApi: CustomFieldsApi | null = null;

  private static apiKey: string | null = process.env.AHA_TOKEN || null;
  private static accessToken: string | null = process.env.AHA_ACCESS_TOKEN || process.env.AHA_TOKEN || null;
  private static subdomain: string | null = process.env.AHA_COMPANY || null;

  /**
   * Initialize the Aha.io API client with authentication
   * This method is optional if environment variables are set
   * @param configOrApiKey Authentication configuration object or API key (for backward compatibility)
   * @param subdomain The Aha.io subdomain (when using backward compatibility)
   */
  public static initialize(
    configOrApiKey?: string | {
      apiKey?: string;
      accessToken?: string;
      subdomain?: string;
    },
    subdomain?: string
  ): void {
    // Handle backward compatibility with old (apiKey, subdomain) signature
    if (typeof configOrApiKey === 'string') {
      this.apiKey = configOrApiKey;
      this.accessToken = configOrApiKey; // Use API key as Bearer token
      if (subdomain) this.subdomain = subdomain;
    } else if (configOrApiKey) {
      // Handle new config object signature
      if (configOrApiKey.apiKey) {
        this.apiKey = configOrApiKey.apiKey;
        this.accessToken = configOrApiKey.apiKey; // Use API key as Bearer token
      }
      if (configOrApiKey.accessToken) this.accessToken = configOrApiKey.accessToken;
      if (configOrApiKey.subdomain) this.subdomain = configOrApiKey.subdomain;
    }

    this.initializeClient();
  }

  /**
   * Initialize with API key (backward compatibility)
   * @param apiKey The Aha.io API key
   * @param subdomain The Aha.io subdomain
   * @deprecated Use initialize({ apiKey, subdomain }) instead
   */
  public static initializeWithApiKey(apiKey?: string, subdomain?: string): void {
    this.initialize({ apiKey, subdomain });
  }

  /**
   * Check if the service is initialized
   * @returns true if the service is initialized, false otherwise
   */
  public static isInitialized(): boolean {
    const hasAuth = this.accessToken;
    return !!(hasAuth && this.subdomain && this.configuration);
  }

  /**
   * Current credentials, for callers that need to reach Aha.io outside the generated
   * aha-js REST client - notably the GraphQL API (which aha-js does not cover) and the
   * hand-rolled competitor update/delete calls below, whose endpoints exist in neither.
   *
   * Read through this rather than from process.env so that credentials supplied at runtime
   * via configure_server are picked up too.
   */
  public static getCredentials(): { subdomain: string | null; accessToken: string | null } {
    return { subdomain: this.subdomain, accessToken: this.accessToken };
  }

  /** Every generated list endpoint types `page`/`perPage` (and several other filters) as strings. */
  private static numParam(value?: number): string | undefined {
    return value === undefined ? undefined : String(value);
  }

  private static boolParam(value?: boolean): string | undefined {
    return value === undefined ? undefined : String(value);
  }

  /**
   * Builds the `options.params` object for filters Aha's OpenAPI document omits from a
   * generated request type. Every generated method still spreads its second `options`
   * argument into the axios request config, and axios merges `params` into the query string
   * the generated call already built - so this is how a filter Aha genuinely accepts gets
   * back on the wire. Strips `undefined` entries so an unused filter is left off the query
   * string instead of being sent as the literal string `"undefined"`.
   */
  private static extraParams(params: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
  }

  /**
   * Get the current user (me) information
   * @returns The current user information
   */
  public static async getMe(): Promise<User> {
    const meApi = this.getMeApi();

    try {
      const response = await meApi.meGet();
      // Generator defect: `meGet` shares its generated response type with `meTasksGet`
      // (`{ tasks, pagination }`); the endpoint genuinely returns the current user under `user`.
      const data = response.data as unknown as { user?: User };
      return data.user as User;
    } catch (error) {
      log.error('Error getting current user', error as Error, { operation: 'getMe' });
      throw error;
    }
  }

  /**
   * Initialize the aha-js client with the current credentials
   * @private
   */
  private static initializeClient(): void {
    if (!this.subdomain) {
      throw new Error('Aha API client not initialized. Subdomain is required. Set AHA_COMPANY environment variable or call initialize().');
    }

    // Check for valid authentication method
    const hasAuth = this.accessToken;
    if (!hasAuth) {
      throw new Error('Aha API client not initialized. Authentication is required. Set AHA_TOKEN or AHA_ACCESS_TOKEN environment variables, or call initialize().');
    }

    try {
      // Create a base path with the subdomain
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;

      // Initialize the configuration with the appropriate authentication method
      // Always use accessToken (Bearer) for Aha.io API tokens
      this.configuration = new Configuration({
        accessToken: this.accessToken || undefined,
        basePath
      });

      // Initialize the API clients
      this.featuresApi = new FeaturesApi(this.configuration);
      this.ideasApi = new IdeasApi(this.configuration);
      this.usersApi = new UsersApi(this.configuration);
      this.epicsApi = new EpicsApi(this.configuration);
      this.productsApi = new ProductsApi(this.configuration);
      this.initiativesApi = new InitiativesApi(this.configuration);
      this.commentsApi = new CommentsApi(this.configuration);
      this.ideaCommentsApi = new IdeaCommentsApi(this.configuration);
      this.goalsApi = new GoalsApi(this.configuration);
      this.keyResultsApi = new KeyResultsApi(this.configuration);
      this.todosApi = new ToDosApi(this.configuration);
      this.competitorsApi = new CompetitorsApi(this.configuration);
      this.requirementsApi = new RequirementsApi(this.configuration);
      this.releasePhasesApi = new ReleasePhasesApi(this.configuration);
      this.releasesApi = new ReleasesApi(this.configuration);
      this.meApi = new MeApi(this.configuration);
      this.strategicModelsApi = new StrategicModelsApi(this.configuration);
      this.ideaOrganizationsApi = new IdeaOrganizationsApi(this.configuration);
      this.ideaVotesApi = new IdeaVotesApi(this.configuration);
      this.customFieldsApi = new CustomFieldsApi(this.configuration);
    } catch (error) {
      log.error('Error initializing Aha.io client', error as Error, { subdomain: this.subdomain });
      throw new Error(`Failed to initialize Aha.io client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the features API instance
   * @returns FeaturesApi instance
   */
  private static getFeaturesApi(): FeaturesApi {
    if (!this.featuresApi) {
      this.initializeClient();
    }
    return this.featuresApi!;
  }

  /**
   * Get the ideas API instance
   * @returns IdeasApi instance
   */
  private static getIdeasApi(): IdeasApi {
    if (!this.ideasApi) {
      this.initializeClient();
    }
    return this.ideasApi!;
  }

  /**
   * Get the users API instance
   * @returns UsersApi instance
   */
  private static getUsersApi(): UsersApi {
    if (!this.usersApi) {
      this.initializeClient();
    }
    return this.usersApi!;
  }

  /**
   * Get the epics API instance
   * @returns EpicsApi instance
   */
  private static getEpicsApi(): EpicsApi {
    if (!this.epicsApi) {
      this.initializeClient();
    }
    return this.epicsApi!;
  }


  /**
   * Get the products API instance
   * @returns ProductsApi instance
   */
  private static getProductsApi(): ProductsApi {
    if (!this.productsApi) {
      this.initializeClient();
    }
    return this.productsApi!;
  }

  /**
   * Get the initiatives API instance
   * @returns InitiativesApi instance
   */
  private static getInitiativesApi(): InitiativesApi {
    if (!this.initiativesApi) {
      this.initializeClient();
    }
    return this.initiativesApi!;
  }

  /**
   * Get the comments API instance
   * @returns CommentsApi instance
   */
  private static getCommentsApi(): CommentsApi {
    if (!this.commentsApi) {
      this.initializeClient();
    }
    return this.commentsApi!;
  }

  /**
   * `IdeaCommentsApi` covers `/ideas/{id}/idea_comments`, which is a different endpoint from
   * the `/ideas/{id}/comments` that `CommentsApi` serves - see the `IdeaComment` type.
   */
  private static getIdeaCommentsApi(): IdeaCommentsApi {
    if (!this.ideaCommentsApi) {
      this.initializeClient();
    }
    return this.ideaCommentsApi!;
  }

  /**
   * Get the goals API instance
   * @returns GoalsApi instance
   */
  private static getGoalsApi(): GoalsApi {
    if (!this.goalsApi) {
      this.initializeClient();
    }
    return this.goalsApi!;
  }

  /**
   * Get the key results API instance
   * @returns KeyResultsApi instance
   */
  private static getKeyResultsApi(): KeyResultsApi {
    if (!this.keyResultsApi) {
      this.initializeClient();
    }
    return this.keyResultsApi!;
  }

  /**
   * Get the todos API instance
   * @returns ToDosApi instance
   */
  private static getTodosApi(): ToDosApi {
    if (!this.todosApi) {
      this.initializeClient();
    }
    return this.todosApi!;
  }

  /**
   * Get the competitors API instance
   * @returns CompetitorsApi instance
   */
  private static getCompetitorsApi(): CompetitorsApi {
    if (!this.competitorsApi) {
      this.initializeClient();
    }
    return this.competitorsApi!;
  }

  /**
   * Get the requirements API instance
   * @returns RequirementsApi instance
   */
  private static getRequirementsApi(): RequirementsApi {
    if (!this.requirementsApi) {
      this.initializeClient();
    }
    return this.requirementsApi!;
  }

  /**
   * Get the release phases API instance
   * @returns ReleasePhasesApi instance
   */
  private static getReleasePhasesApi(): ReleasePhasesApi {
    if (!this.releasePhasesApi) {
      this.initializeClient();
    }
    return this.releasePhasesApi!;
  }

  /**
   * Get the releases API instance
   * @returns ReleasesApi instance
   */
  private static getReleasesApi(): ReleasesApi {
    if (!this.releasesApi) {
      this.initializeClient();
    }
    return this.releasesApi!;
  }

  /**
   * Get the me API instance
   * @returns MeApi instance
   */
  private static getMeApi(): MeApi {
    if (!this.meApi) {
      this.initializeClient();
    }
    return this.meApi!;
  }

  /**
   * Get the strategic models API instance
   * @returns StrategicModelsApi instance
   */
  private static getStrategicModelsApi(): StrategicModelsApi {
    if (!this.strategicModelsApi) {
      this.initializeClient();
    }
    return this.strategicModelsApi!;
  }

  /**
   * Get the idea organizations API instance
   * @returns IdeaOrganizationsApi instance
   */
  private static getIdeaOrganizationsApi(): IdeaOrganizationsApi {
    if (!this.ideaOrganizationsApi) {
      this.initializeClient();
    }
    return this.ideaOrganizationsApi!;
  }

  /**
   * Get the idea votes API instance
   * @returns IdeaVotesApi instance
   */
  private static getIdeaVotesApi(): IdeaVotesApi {
    if (!this.ideaVotesApi) {
      this.initializeClient();
    }
    return this.ideaVotesApi!;
  }

  /**
   * Get the custom fields API instance
   * @returns CustomFieldsApi instance
   */
  private static getCustomFieldsApi(): CustomFieldsApi {
    if (!this.customFieldsApi) {
      this.initializeClient();
    }
    return this.customFieldsApi!;
  }

  /**
   * List features from Aha.io
   * @param query Search query (optional)
   * @param updatedSince Filter by updated since date (optional)
   * @param tag Filter by tag (optional)
   * @param assignedToUser Filter by assigned user (optional)
   * @param page Page number for pagination (optional)
   * @param perPage Number of items per page (max 200) (optional)
   * @returns A list of features
   */
  public static async listFeatures(
    query?: string,
    updatedSince?: string,
    tag?: string,
    assignedToUser?: string,
    page?: number,
    perPage?: number
  ): Promise<FeaturesListResponse> {
    const featuresApi = this.getFeaturesApi();

    try {
      // `q`, `updatedSince`, `tag` and `assignedToUser` are sent via `options.params` because
      // Aha's spec under-documents this endpoint's query string - only pagination and
      // `fields`/`workflow_status` (unused here) remain in the generated request type.
      const response = await featuresApi.featuresGet(
        {
          page: this.numParam(page),
          perPage: this.numParam(perPage)
        },
        {
          params: this.extraParams({
            q: query,
            updated_since: updatedSince,
            tag,
            assigned_to_user: assignedToUser
          })
        }
      );
      return response.data as unknown as FeaturesListResponse;
    } catch (error) {
      // This method alone used to time itself and read a status code off the error, then use
      // neither - leftovers from tracing that was removed. The status travels with the error
      // instead, for describeAhaError to read at the boundary.
      log.error('Error listing features', error as Error, { operation: 'listFeatures' });
      throw error;
    }
  }

  /**
   * Get a specific feature by ID
   * @param featureId The ID of the feature
   * @returns The feature details
   */
  public static async getFeature(featureId: string): Promise<Feature> {
    const featuresApi = this.getFeaturesApi();

    try {
      const response = await featuresApi.featuresByIdGet({ id: featureId });
      // Generator defect: `featuresByIdGet` is typed as returning the list response
      // (`{ features, pagination }`); the endpoint genuinely returns a single feature
      // wrapped as `{ feature }`.
      const data = response.data as unknown as { feature?: Feature };
      if (!data.feature) {
        throw new Error(`Feature ${featureId} not found`);
      }
      return data.feature;
    } catch (error) {
      log.error('Error getting feature', error as Error, { operation: 'getFeature', feature_id: featureId });
      throw error;
    }
  }

  /**
   * List users from Aha.io
   * @returns A list of users
   */
  public static async listUsers(): Promise<{ users: User[] }> {
    const usersApi = this.getUsersApi();

    try {
      const response = await usersApi.usersGet();
      // Generator defect: `usersGet` is typed as `{ user_roles, pagination }`, reused from an
      // unrelated operation. The endpoint returns `{ users, pagination }`.
      const data = response.data as unknown as { users?: User[] };
      return { users: data.users ?? [] };
    } catch (error) {
      log.error('Error listing users', error as Error, { operation: 'listUsers' });
      throw error;
    }
  }

  /**
   * Get a specific user by ID
   * @param userId The ID of the user
   * @returns The user details
   */
  public static async getUser(userId: string): Promise<User> {
    const usersApi = this.getUsersApi();

    try {
      const response = await usersApi.usersByIdGet({ id: userId });
      // Generator defect: typed as `{ user_roles, pagination }`; the endpoint returns the
      // user object directly with no wrapper.
      return response.data as unknown as User;
    } catch (error) {
      log.error('Error getting user', error as Error, { operation: 'getUser', user_id: userId });
      throw error;
    }
  }

  /**
   * List epics in a product
   * @param productId The ID of the product
   * @returns A list of epics
   */
  public static async listEpics(productId: string): Promise<EpicsListResponse> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.productsByProductEpicsGet({ productId });
      return response.data as unknown as EpicsListResponse;
    } catch (error) {
      log.error('Error listing epics for product', error as Error, { operation: 'listEpics', product_id: productId });
      throw error;
    }
  }

  /**
   * Get a specific epic by ID
   * @param epicId The ID of the epic
   * @returns The epic details
   */
  public static async getEpic(epicId: string): Promise<Epic> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.epicsByIdGet({ id: epicId });
      // Generator defect: `epicsByIdGet` is typed as returning the list response
      // (`{ epics, pagination }`); the endpoint genuinely returns a single epic with no
      // wrapper.
      return response.data as unknown as Epic;
    } catch (error) {
      log.error('Error getting epic', error as Error, { operation: 'getEpic', epic_id: epicId });
      throw error;
    }
  }

  /**
   * Create a comment on a feature
   * @param featureId The ID of the feature
   * @param body The comment body
   * @returns The created comment
   */
  public static async createFeatureComment(featureId: string, body: string): Promise<Comment> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.featuresByFeatureCommentsPost({
        featureId: featureId,
        commentsPostRequest: {
          comment: { body }
        }
      });
      const data = response.data as unknown as { comment?: Comment };
      return data.comment as Comment;
    } catch (error) {
      log.error('Error creating comment on feature', error as Error, { operation: 'createFeatureComment', feature_id: featureId });
      throw error;
    }
  }

  /**
   * Get a specific idea by ID
   * @param ideaId The ID of the idea
   * @returns The idea details
   */
  public static async getIdea(ideaId: string): Promise<IdeaResponse> {
    const ideasApi = this.getIdeasApi();

    try {
      const response = await ideasApi.ideasByIdGet({ id: ideaId });
      // Generator defect: `ideasByIdGet` is typed as returning the list response
      // (`{ ideas, pagination }`); the endpoint genuinely returns a single idea wrapped as
      // `{ idea }`.
      return response.data as unknown as IdeaResponse;
    } catch (error) {
      log.error('Error getting idea', error as Error, { operation: 'getIdea', idea_id: ideaId });
      throw error;
    }
  }

  /**
   * Get a specific product by ID
   * @param productId The ID of the product
   * @returns The product details
   */
  public static async getProduct(productId: string): Promise<Product> {
    const productsApi = this.getProductsApi();

    try {
      const response = await productsApi.productsByIdGet({ id: productId });
      const data = response.data as unknown as { product?: Product };
      return data.product as Product;
    } catch (error) {
      log.error('Error getting product', error as Error, { operation: 'getProduct', product_id: productId });
      throw error;
    }
  }

  /**
   * List products from Aha.io
   * @param updatedSince Filter by updated since date (optional)
   * @param page Page number for pagination (optional)
   * @param perPage Number of items per page (max 200) (optional)
   * @returns A list of products
   */
  public static async listProducts(
    updatedSince?: string,
    page?: number,
    perPage?: number
  ): Promise<ProductsListResponse> {
    const productsApi = this.getProductsApi();

    try {
      // Generator defect: `productsGet` (list) shares its response type with
      // `productsByIdGet` (`{ product }`, singular); the endpoint returns `{ products, pagination }`.
      // `updatedSince` is sent via `options.params` because Aha's spec under-documents this
      // endpoint's query string.
      const response = await productsApi.productsGet(
        {
          page: this.numParam(page),
          perPage: this.numParam(perPage)
        },
        { params: this.extraParams({ updated_since: updatedSince }) }
      );
      return response.data as unknown as ProductsListResponse;
    } catch (error) {
      log.error('Error listing products', error as Error, { operation: 'listProducts' });
      throw error;
    }
  }

  /**
   * Get a specific initiative by ID
   * @param initiativeId The ID of the initiative
   * @returns The initiative details
   */
  public static async getInitiative(initiativeId: string): Promise<InitiativeResponse> {
    const initiativesApi = this.getInitiativesApi();

    try {
      const response = await initiativesApi.initiativesByIdGet({ id: initiativeId });
      // Generator defect: `initiativesByIdGet` is typed as returning the list response
      // (`{ initiatives, pagination }`); the endpoint genuinely returns a single initiative
      // wrapped as `{ initiative }`.
      return response.data as unknown as InitiativeResponse;
    } catch (error) {
      log.error('Error getting initiative', error as Error, { operation: 'getInitiative', initiative_id: initiativeId });
      throw error;
    }
  }

  /**
   * List initiatives from Aha.io
   * @param query Search term to match against initiative name (optional)
   * @param updatedSince UTC timestamp (ISO8601 format) (optional)
   * @param assignedToUser ID or email address of a user (optional)
   * @param onlyActive When true, returns only active initiatives (optional)
   * @param page Page number for pagination (optional)
   * @param perPage Number of items per page (max 200) (optional)
   * @returns A list of initiatives
   */
  public static async listInitiatives(
    query?: string,
    updatedSince?: string,
    assignedToUser?: string,
    onlyActive?: boolean,
    page?: number,
    perPage?: number
  ): Promise<InitiativesListResponse> {
    const initiativesApi = this.getInitiativesApi();

    try {
      // `q`, `updatedSince`, `assignedToUser` and `onlyActive` are sent via `options.params`
      // because Aha's spec under-documents this endpoint's query string - only pagination
      // (plus `custom_fields` and `workflow_status`, which this service does not expose)
      // remain in the generated request type.
      const response = await initiativesApi.initiativesGet(
        {
          page: this.numParam(page),
          perPage: this.numParam(perPage)
        },
        {
          params: this.extraParams({
            q: query,
            updated_since: updatedSince,
            assigned_to_user: assignedToUser,
            only_active: onlyActive
          })
        }
      );
      return response.data as unknown as InitiativesListResponse;
    } catch (error) {
      log.error('Error listing initiatives', error as Error, { operation: 'listInitiatives' });
      throw error;
    }
  }

  /**
   * List ideas for a specific product
   * @param productId The ID of the product
   * @param query Search term to match against idea name (optional)
   * @param spam When true, shows ideas marked as spam (optional)
   * @param workflowStatus Filters to ideas with provided workflow status ID or name (optional)
   * @param sort Sorting options: 'recent', 'trending', 'popular' (optional)
   * @param createdBefore UTC timestamp (ISO8601 format) (optional)
   * @param createdSince UTC timestamp (ISO8601 format) (optional)
   * @param updatedSince UTC timestamp (ISO8601 format) (optional)
   * @param tag String tag value (optional)
   * @param userId ID of a user who created the idea (optional)
   * @param ideaUserId ID of an idea user who created the idea (optional)
   * @returns A list of ideas for the product
   */
  public static async listIdeasByProduct(
    productId: string,
    query?: string,
    spam?: boolean,
    workflowStatus?: string,
    sort?: string,
    createdBefore?: string,
    createdSince?: string,
    updatedSince?: string,
    tag?: string,
    userId?: string,
    ideaUserId?: string
  ): Promise<IdeasListResponse> {
    const ideasApi = this.getIdeasApi();

    try {
      // `ideaUserId` has no equivalent in the generated request type for this endpoint, so it
      // is sent via `options.params` because Aha's spec under-documents this endpoint's query
      // string.
      const response = await ideasApi.productsByProductIdeasGet(
        {
          productId: productId,
          q: query,
          spam: this.boolParam(spam),
          workflowStatus,
          sort,
          createdBefore,
          createdSince,
          updatedSince,
          tag,
          userId
        },
        { params: this.extraParams({ idea_user_id: ideaUserId }) }
      );
      return response.data as unknown as IdeasListResponse;
    } catch (error) {
      log.error('Error listing ideas for product', error as Error, { operation: 'listIdeasByProduct', product_id: productId });
      throw error;
    }
  }

  /**
   * Get comments for a specific epic
   * @param epicId The ID of the epic
   * @returns A list of comments for the epic
   */
  public static async getEpicComments(epicId: string): Promise<CommentsListResponse> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.epicsByEpicCommentsGet({ epicId });
      return response.data as unknown as CommentsListResponse;
    } catch (error) {
      log.error('Error getting comments for epic', error as Error, { operation: 'getEpicComments', epic_id: epicId });
      throw error;
    }
  }

  /**
   * Get comments for a specific idea
   * @param ideaId The ID of the idea
   * @returns A list of comments for the idea
   */
  public static async getIdeaComments(ideaId: string): Promise<CommentsListResponse> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.ideasByIdeaCommentsGet({ ideaId });
      return response.data as unknown as CommentsListResponse;
    } catch (error) {
      log.error('Error getting comments for idea', error as Error, { operation: 'getIdeaComments', idea_id: ideaId });
      throw error;
    }
  }

  /**
   * Get comments for a specific initiative
   * @param initiativeId The ID of the initiative
   * @returns A list of comments for the initiative
   */
  public static async getInitiativeComments(initiativeId: string): Promise<CommentsListResponse> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.initiativesByInitiativeCommentsGet({ initiativeId });
      return response.data as unknown as CommentsListResponse;
    } catch (error) {
      log.error('Error getting comments for initiative', error as Error, { operation: 'getInitiativeComments', initiative_id: initiativeId });
      throw error;
    }
  }

  /**
   * Get comments for a specific product
   * @param productId The ID of the product
   * @returns A list of comments for the product
   */
  public static async getProductComments(productId: string): Promise<CommentsListResponse> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.productsByProjectCommentsGet({ projectId: productId });
      return response.data as unknown as CommentsListResponse;
    } catch (error) {
      log.error('Error getting comments for product', error as Error, { operation: 'getProductComments', product_id: productId });
      throw error;
    }
  }

  /**
   * Get comments for a specific goal
   * @param goalId The ID of the goal
   * @returns A list of comments for the goal
   */
  public static async getGoalComments(goalId: string): Promise<CommentsListResponse> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.goalsByGoalCommentsGet({ goalId });
      return response.data as unknown as CommentsListResponse;
    } catch (error) {
      log.error('Error getting comments for goal', error as Error, { operation: 'getGoalComments', goal_id: goalId });
      throw error;
    }
  }

  /**
   * Get comments for a specific release
   * @param releaseId The ID of the release
   * @returns A list of comments for the release
   */
  public static async getReleaseComments(releaseId: string): Promise<CommentsListResponse> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.releasesByReleaseCommentsGet({ releaseId });
      return response.data as unknown as CommentsListResponse;
    } catch (error) {
      log.error('Error getting comments for release', error as Error, { operation: 'getReleaseComments', release_id: releaseId });
      throw error;
    }
  }

  /**
   * Get comments for a specific release phase
   * @param releasePhaseId The ID of the release phase
   * @returns A list of comments for the release phase
   */
  public static async getReleasePhaseComments(releasePhaseId: string): Promise<CommentsListResponse> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.releasePhasesByReleasePhaseCommentsGet({ releasePhaseId });
      return response.data as unknown as CommentsListResponse;
    } catch (error) {
      log.error('Error getting comments for release phase', error as Error, { operation: 'getReleasePhaseComments', release_phase_id: releasePhaseId });
      throw error;
    }
  }

  /**
   * Get comments for a specific requirement
   * @param requirementId The ID of the requirement
   * @returns A list of comments for the requirement
   */
  public static async getRequirementComments(requirementId: string): Promise<CommentsListResponse> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.requirementsByRequirementCommentsGet({ requirementId });
      return response.data as unknown as CommentsListResponse;
    } catch (error) {
      log.error('Error getting comments for requirement', error as Error, { operation: 'getRequirementComments', requirement_id: requirementId });
      throw error;
    }
  }

  /**
   * Get comments for a specific todo
   * @param todoId The ID of the todo
   * @returns A list of comments for the todo
   */
  public static async getTodoComments(todoId: string): Promise<CommentsListResponse> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.tasksByTaskCommentsGet({ taskId: todoId });
      return response.data as unknown as CommentsListResponse;
    } catch (error) {
      log.error('Error getting comments for todo', error as Error, { operation: 'getTodoComments', todo_id: todoId });
      throw error;
    }
  }

  /**
   * Get comments for a specific feature
   * @param featureId The ID of the feature
   * @returns A list of comments for the feature
   */
  public static async getFeatureComments(featureId: string): Promise<CommentsListResponse> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.featuresByFeatureCommentsGet({ featureId });
      return response.data as unknown as CommentsListResponse;
    } catch (error) {
      log.error('Error getting comments for feature', error as Error, { operation: 'getFeatureComments', feature_id: featureId });
      throw error;
    }
  }

  /**
   * Every `POST .../comments` endpoint takes the same body and answers with `{ comment }`,
   * so the per-type creators differ only in which SDK method they call. One helper keeps
   * that from becoming nine copies of the same five lines.
   */
  private static async postComment(
    operation: string,
    context: Record<string, unknown>,
    body: string,
    call: (
      api: CommentsApi,
      request: { comment: { body: string } }
    ) => Promise<{ data: unknown }>
  ): Promise<Comment> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await call(commentsApi, { comment: { body } });
      const data = response.data as { comment?: Comment };
      return data.comment as Comment;
    } catch (error) {
      log.error('Error creating comment', error as Error, { operation, ...context });
      throw error;
    }
  }

  public static async createEpicComment(epicId: string, body: string): Promise<Comment> {
    return this.postComment('createEpicComment', { epic_id: epicId }, body, (api, request) =>
      api.epicsByEpicCommentsPost({ epicId, commentsPostRequest: request })
    );
  }

  /**
   * Comment on an idea *internally*. Aha documents `POST /ideas/{id}/comments` as creating an
   * internal comment; it cannot reach the ideas portal, and the record it creates will not
   * appear in `getIdeaPortalComments`. Use `createIdeaPortalComment` to reply to a customer.
   */
  public static async createIdeaComment(ideaId: string, body: string): Promise<Comment> {
    return this.postComment('createIdeaComment', { idea_id: ideaId }, body, (api, request) =>
      api.ideasByIdeaCommentsPost({ ideaId, commentsPostRequest: request })
    );
  }

  public static async createInitiativeComment(initiativeId: string, body: string): Promise<Comment> {
    return this.postComment(
      'createInitiativeComment',
      { initiative_id: initiativeId },
      body,
      (api, request) => api.initiativesByInitiativeCommentsPost({ initiativeId, commentsPostRequest: request })
    );
  }

  public static async createGoalComment(goalId: string, body: string): Promise<Comment> {
    return this.postComment('createGoalComment', { goal_id: goalId }, body, (api, request) =>
      api.goalsByGoalCommentsPost({ goalId, commentsPostRequest: request })
    );
  }

  public static async createReleaseComment(releaseId: string, body: string): Promise<Comment> {
    return this.postComment('createReleaseComment', { release_id: releaseId }, body, (api, request) =>
      api.releasesByReleaseCommentsPost({ releaseId, commentsPostRequest: request })
    );
  }

  public static async createReleasePhaseComment(releasePhaseId: string, body: string): Promise<Comment> {
    return this.postComment(
      'createReleasePhaseComment',
      { release_phase_id: releasePhaseId },
      body,
      (api, request) => api.releasePhasesByReleasePhaseCommentsPost({ releasePhaseId, commentsPostRequest: request })
    );
  }

  public static async createRequirementComment(requirementId: string, body: string): Promise<Comment> {
    return this.postComment(
      'createRequirementComment',
      { requirement_id: requirementId },
      body,
      (api, request) => api.requirementsByRequirementCommentsPost({ requirementId, commentsPostRequest: request })
    );
  }

  /** Todos are `/tasks` in Aha's API; see the aha-js 2.0.0 migration notes. */
  public static async createTodoComment(todoId: string, body: string): Promise<Comment> {
    return this.postComment('createTodoComment', { todo_id: todoId }, body, (api, request) =>
      api.tasksByTaskCommentsPost({ taskId: todoId, commentsPostRequest: request })
    );
  }

  /**
   * An idea's portal comments - a different endpoint from `getIdeaComments`, over records
   * that endpoint never returns. See the `IdeaComment` type for what the split is and why
   * reading only one side is misleading.
   */
  public static async getIdeaPortalComments(ideaId: string): Promise<IdeaCommentsListResponse> {
    const ideaCommentsApi = this.getIdeaCommentsApi();

    try {
      const response = await ideaCommentsApi.ideasByIdeaIdeaCommentsGet({ ideaId });
      return response.data as unknown as IdeaCommentsListResponse;
    } catch (error) {
      log.error('Error getting portal comments for idea', error as Error, {
        operation: 'getIdeaPortalComments',
        idea_id: ideaId
      });
      throw error;
    }
  }

  /**
   * Create a comment on an idea that can reach the ideas portal.
   *
   * `visibility` is a required argument on purpose. Aha defaults it to `public`, so an
   * omitted value publishes to customers - not a thing that should happen because a caller
   * left a field out.
   *
   * The cast is needed because this SDK is generated from recorded test responses, and the
   * only field its `IdeacommentsPostRequest` model captured is `spam`. Aha documents the
   * body as `{ idea_comment: { body, visibility } }`, which is what goes on the wire; the
   * cast admits it without hand-rolling the request the way `competitorRequest` has to.
   */
  public static async createIdeaPortalComment(
    ideaId: string,
    body: string,
    visibility: IdeaCommentVisibility
  ): Promise<IdeaComment> {
    const ideaCommentsApi = this.getIdeaCommentsApi();

    try {
      const response = await ideaCommentsApi.ideasByIdeaIdeaCommentsPost({
        ideaId,
        ideacommentsPostRequest: {
          idea_comment: { body, visibility }
        } as unknown as IdeacommentsPostRequest
      });
      const data = response.data as unknown as { idea_comment?: IdeaComment };
      return (data.idea_comment ?? (data as IdeaComment)) as IdeaComment;
    } catch (error) {
      log.error('Error creating portal comment on idea', error as Error, {
        operation: 'createIdeaPortalComment',
        idea_id: ideaId,
        visibility
      });
      throw error;
    }
  }

  /**
   * Get a specific goal by ID
   * @param goalId The ID of the goal
   * @returns The goal details
   */
  public static async getGoal(goalId: string): Promise<GoalGetResponse> {
    const goalsApi = this.getGoalsApi();

    try {
      const response = await goalsApi.goalsByIdGet({ id: goalId });
      // Generator defect: `goalsByIdGet` is typed as returning the list response
      // (`{ goals, pagination }`); the endpoint genuinely returns a single goal wrapped as
      // `{ goal }`.
      return response.data as unknown as GoalGetResponse;
    } catch (error) {
      log.error('Error getting goal', error as Error, { operation: 'getGoal', goal_id: goalId });
      throw error;
    }
  }

  /**
   * List goals from Aha.io
   * @param query Search query (optional)
   * @param updatedSince Filter by updated since date (optional)
   * @param assignedToUser Filter by assigned user (optional)
   * @param status Filter by status (optional)
   * @param page Page number for pagination (optional)
   * @param perPage Number of items per page (max 200) (optional)
   * @returns A list of goals
   */
  public static async listGoals(
    query?: string,
    updatedSince?: string,
    assignedToUser?: string,
    status?: string,
    page?: number,
    perPage?: number
  ): Promise<GoalsListResponse> {
    const goalsApi = this.getGoalsApi();

    try {
      // `q`, `updatedSince`, `assignedToUser` and `status` are sent via `options.params`
      // because Aha's spec under-documents this endpoint's query string - only pagination
      // remains in the generated request type.
      const response = await goalsApi.goalsGet(
        {
          page: this.numParam(page),
          perPage: this.numParam(perPage)
        },
        {
          params: this.extraParams({
            q: query,
            updated_since: updatedSince,
            assigned_to_user: assignedToUser,
            status
          })
        }
      );
      return response.data as unknown as GoalsListResponse;
    } catch (error) {
      log.error('Error listing goals', error as Error, { operation: 'listGoals' });
      throw error;
    }
  }

  /**
   * Get epics associated with a specific goal
   * @param goalId The ID of the goal
   * @returns A list of epics associated with the goal
   */
  public static async getGoalEpics(goalId: string): Promise<GoalEpicsResponse> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.goalsByGoalEpicsGet({ goalId });
      return response.data as unknown as GoalEpicsResponse;
    } catch (error) {
      log.error('Error getting epics for goal', error as Error, { operation: 'getGoalEpics', goal_id: goalId });
      throw error;
    }
  }

  /**
   * Create a goal in a workspace
   *
   * Goal creation is workspace-scoped - `POST /products/{product_id}/goals` - so there is no
   * account-level create; a goal always belongs to one workspace.
   *
   * The generated `GoalsPostRequest` body type only knows `description` and
   * `workflow_status`, because aha-js' spec is derived from recorded fixtures. Aha's own
   * documentation for this endpoint also accepts `name` (required in practice),
   * `success_metric_name`, `success_metric_description`, `time_frame`, `effort`, `value`,
   * `parent_id`, `progress_source` and `progress`, so the payload is passed through as-is and
   * cast at the boundary rather than narrowed to the generated shape.
   *
   * @param productId The ID or key of the workspace (Aha product) to create the goal in
   * @param goalData The goal payload, wrapped as `{ goal: { ... } }`
   * @returns The created goal
   */
  public static async createGoal(productId: string, goalData: any): Promise<GoalGetResponse> {
    const goalsApi = this.getGoalsApi();

    try {
      const response = await goalsApi.productsByProductGoalsPost({
        productId,
        goalsPostRequest: goalData
      });
      return response.data as unknown as GoalGetResponse;
    } catch (error) {
      log.error('Error creating goal', error as Error, { operation: 'createGoal', product_id: productId });
      throw error;
    }
  }

  /**
   * Update a goal
   *
   * Two routes reach the same record. Aha documents the workspace-scoped
   * `PUT /products/{product_id}/goals/{id}`; `PUT /goals/{id}` is what aha-js was generated
   * against and needs no workspace id, which matches how every other updater here is called.
   * So the account-level route is the default and `productId` selects the documented one -
   * useful if an account rejects the shorter form.
   *
   * That the account-level route exists was measured, not assumed: `PUT /goals/0` answers
   * `{"error":"Record not found."}` as JSON, whereas a route Aha does not serve at all answers
   * with its HTML 404 page. Same for `PUT /key_results/{id}`.
   *
   * @param goalId The ID or reference number of the goal
   * @param goalData The goal payload, wrapped as `{ goal: { ... } }`
   * @param productId Optional workspace id, to use Aha's documented workspace-scoped route
   * @returns The updated goal
   */
  public static async updateGoal(
    goalId: string,
    goalData: any,
    productId?: string
  ): Promise<GoalGetResponse> {
    const goalsApi = this.getGoalsApi();

    try {
      const response = productId
        ? await goalsApi.productsByProductGoalsByIdPut({
            productId,
            id: goalId,
            goalsPostRequest: goalData
          })
        : await goalsApi.goalsByIdPut({ id: goalId, goalsPutRequest: goalData });
      return response.data as unknown as GoalGetResponse;
    } catch (error) {
      log.error('Error updating goal', error as Error, { operation: 'updateGoal', goal_id: goalId });
      throw error;
    }
  }

  /**
   * Delete a goal
   *
   * Only the workspace-scoped route exists - `DELETE /products/{product_id}/goals/{id}` - so
   * unlike the other deletes here this one needs the goal's workspace. A goal read through
   * `getGoal` carries it as `product_id`.
   *
   * @param productId The ID or key of the workspace the goal belongs to
   * @param goalId The ID or reference number of the goal
   */
  public static async deleteGoal(productId: string, goalId: string): Promise<void> {
    const goalsApi = this.getGoalsApi();

    try {
      await goalsApi.productsByProductGoalsByIdDelete({ productId, id: goalId });
    } catch (error) {
      log.error('Error deleting goal', error as Error, { operation: 'deleteGoal', goal_id: goalId, product_id: productId });
      throw error;
    }
  }

  /**
   * List the key results belonging to a goal
   *
   * @param goalId The ID or reference number of the goal
   * @param page Page number for pagination (optional)
   * @param perPage Number of items per page (optional)
   * @returns The goal's key results
   */
  public static async listKeyResults(
    goalId: string,
    page?: number,
    perPage?: number
  ): Promise<KeyResultsListResponse> {
    const keyResultsApi = this.getKeyResultsApi();

    try {
      const response = await keyResultsApi.goalsByGoalKeyResultsGet({
        goalId,
        page: this.numParam(page),
        perPage: this.numParam(perPage)
      });
      // Generator defect: `goalsByGoalKeyResultsGet` is typed as returning the single-record
      // wrapper (`{ key_result }`); the endpoint returns `{ key_results, pagination }`.
      return response.data as unknown as KeyResultsListResponse;
    } catch (error) {
      log.error('Error listing key results', error as Error, { operation: 'listKeyResults', goal_id: goalId });
      throw error;
    }
  }

  /**
   * Get a specific key result by ID
   * @param keyResultId The ID or reference number of the key result
   * @returns The key result, wrapped as `{ key_result }`
   */
  public static async getKeyResult(keyResultId: string): Promise<KeyResultResponse> {
    const keyResultsApi = this.getKeyResultsApi();

    try {
      const response = await keyResultsApi.keyResultsByIdGet({ id: keyResultId });
      return response.data as unknown as KeyResultResponse;
    } catch (error) {
      log.error('Error getting key result', error as Error, { operation: 'getKeyResult', key_result_id: keyResultId });
      throw error;
    }
  }

  /**
   * Create a key result under a goal
   *
   * @param goalId The ID or reference number of the goal that will own the key result
   * @param keyResultData The key result payload, wrapped as `{ key_result: { ... } }`
   * @returns The created key result
   */
  public static async createKeyResult(goalId: string, keyResultData: any): Promise<KeyResultResponse> {
    const keyResultsApi = this.getKeyResultsApi();

    try {
      const response = await keyResultsApi.goalsByGoalKeyResultsPost({
        goalId,
        keyresultsPostRequest: this.normalizeKeyResultPayload(keyResultData)
      });
      return response.data as unknown as KeyResultResponse;
    } catch (error) {
      log.error('Error creating key result', error as Error, { operation: 'createKeyResult', goal_id: goalId });
      throw error;
    }
  }

  /**
   * Update a key result
   *
   * @param keyResultId The ID or reference number of the key result
   * @param keyResultData The key result payload, wrapped as `{ key_result: { ... } }`
   * @returns The updated key result
   */
  public static async updateKeyResult(keyResultId: string, keyResultData: any): Promise<KeyResultResponse> {
    const keyResultsApi = this.getKeyResultsApi();

    try {
      const response = await keyResultsApi.keyResultsByIdPut({
        id: keyResultId,
        keyresultsPostRequest: this.normalizeKeyResultPayload(keyResultData)
      });
      return response.data as unknown as KeyResultResponse;
    } catch (error) {
      log.error('Error updating key result', error as Error, { operation: 'updateKeyResult', key_result_id: keyResultId });
      throw error;
    }
  }

  /**
   * Delete a key result
   * @param keyResultId The ID or reference number of the key result
   */
  public static async deleteKeyResult(keyResultId: string): Promise<void> {
    const keyResultsApi = this.getKeyResultsApi();

    try {
      await keyResultsApi.keyResultsByIdDelete({ id: keyResultId });
    } catch (error) {
      log.error('Error deleting key result', error as Error, { operation: 'deleteKeyResult', key_result_id: keyResultId });
      throw error;
    }
  }

  /**
   * Key results take `workflow_status` as an object (`{ name: "On track" }`), unlike goals,
   * which take a bare string. The tools accept either, because a caller that has just read a
   * key result has an object in hand and a caller naming a status has a string - so the
   * difference is resolved here instead of failing at Aha with a 422.
   */
  private static normalizeKeyResultPayload(keyResultData: any): any {
    const status = keyResultData?.key_result?.workflow_status;
    if (typeof status !== 'string') return keyResultData;

    return {
      ...keyResultData,
      key_result: { ...keyResultData.key_result, workflow_status: { name: status } }
    };
  }

  /**
   * Get a specific release by ID
   * @param releaseId The ID of the release
   * @returns The release details
   */
  public static async getRelease(releaseId: string): Promise<ReleaseGetResponse> {
    const releasesApi = this.getReleasesApi();

    try {
      const response = await releasesApi.releasesByIdGet({ id: releaseId });
      // Generator defect: `releasesByIdGet` is typed as returning the list response
      // (`{ releases, pagination }`); the endpoint genuinely returns a single release wrapped
      // as `{ release }`.
      return response.data as unknown as ReleaseGetResponse;
    } catch (error) {
      log.error('Error getting release', error as Error, { operation: 'getRelease', release_id: releaseId });
      throw error;
    }
  }

  /**
   * Get features associated with a specific release
   * @param releaseId The ID of the release
   * @returns A list of features associated with the release
   */
  public static async getReleaseFeatures(releaseId: string): Promise<ReleaseFeaturesResponse> {
    try {
      // Use direct API call since SDK method returns void
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/releases/${releaseId}/features`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get release features: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      log.error('Error getting features for release', error as Error, { operation: 'getReleaseFeatures', release_id: releaseId });
      throw error;
    }
  }

  /**
   * Get epics associated with a specific release
   * @param releaseId The ID of the release
   * @returns A list of epics associated with the release
   */
  public static async getReleaseEpics(releaseId: string): Promise<EpicsListResponse> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.releasesByReleaseEpicsGet({ releaseId });
      return response.data as unknown as EpicsListResponse;
    } catch (error) {
      log.error('Error getting epics for release', error as Error, { operation: 'getReleaseEpics', release_id: releaseId });
      throw error;
    }
  }

  /**
   * Get a specific release phase by ID
   * @param releasePhaseId The ID of the release phase
   * @returns The release phase details
   */
  public static async getReleasePhase(releasePhaseId: string): Promise<ReleasePhase> {
    const releasePhasesApi = this.getReleasePhasesApi();

    try {
      const response = await releasePhasesApi.releasePhasesByIdGet({ id: releasePhaseId });
      // Generator defect: `releasePhasesByIdGet` is typed as returning the list response
      // (`{ release_phases, pagination }`); the endpoint genuinely returns a single release
      // phase wrapped as `{ release_phase }`.
      const data = response.data as unknown as { release_phase?: ReleasePhase };
      if (!data.release_phase) {
        throw new Error(`Release phase ${releasePhaseId} not found`);
      }
      return data.release_phase;
    } catch (error) {
      log.error('Error getting release phase', error as Error, { operation: 'getReleasePhase', release_phase_id: releasePhaseId });
      throw error;
    }
  }

  /**
   * List release phases from Aha.io
   * @returns A list of release phases
   */
  public static async listReleasePhases(): Promise<ReleasePhasesListResponse> {
    const releasePhasesApi = this.getReleasePhasesApi();

    try {
      const response = await releasePhasesApi.releasePhasesGet();
      return response.data as unknown as ReleasePhasesListResponse;
    } catch (error) {
      log.error('Error listing release phases', error as Error, { operation: 'listReleasePhases' });
      throw error;
    }
  }

  /**
   * Get a specific requirement by ID
   * @param requirementId The ID of the requirement
   * @returns The requirement details
   */
  public static async getRequirement(requirementId: string): Promise<Requirement> {
    const requirementsApi = this.getRequirementsApi();

    try {
      const response = await requirementsApi.requirementsByIdGet({ id: requirementId });
      const data = response.data as unknown as { requirement?: Requirement };
      if (!data.requirement) {
        throw new Error(`Requirement ${requirementId} not found`);
      }
      return data.requirement;
    } catch (error) {
      log.error('Error getting requirement', error as Error, { operation: 'getRequirement', requirement_id: requirementId });
      throw error;
    }
  }

  /**
   * Get a specific competitor by ID
   * @param competitorId The ID of the competitor
   * @returns The competitor details
   */
  public static async getCompetitor(competitorId: string): Promise<Competitor> {
    const competitorsApi = this.getCompetitorsApi();

    try {
      const response = await competitorsApi.competitorsByIdGet({ id: competitorId });
      // Generator defect: `competitorsByIdGet` is typed as returning the (product-scoped)
      // list response (`{ competitors, pagination }`); the endpoint genuinely returns a
      // single competitor with no wrapper.
      return response.data as unknown as Competitor;
    } catch (error) {
      log.error('Error getting competitor', error as Error, { operation: 'getCompetitor', competitor_id: competitorId });
      throw error;
    }
  }

  /**
   * Get a specific todo by ID
   * @param todoId The ID of the todo
   * @returns The todo details
   */
  public static async getTodo(todoId: string): Promise<Todo> {
    const todosApi = this.getTodosApi();

    try {
      const response = await todosApi.tasksByIdGet({ id: todoId });
      // Generator defect: `tasksByIdGet` is typed as returning the list response
      // (`{ tasks, pagination }`); the endpoint genuinely returns a single task wrapped as
      // `{ task }`.
      const data = response.data as unknown as { task?: Todo };
      if (!data.task) {
        throw new Error(`Todo ${todoId} not found`);
      }
      return data.task;
    } catch (error) {
      log.error('Error getting todo', error as Error, { operation: 'getTodo', todo_id: todoId });
      throw error;
    }
  }

  /**
   * List competitors for a specific product
   * @param productId The ID of the product
   * @returns A list of competitors for the product
   */
  public static async listCompetitors(productId: string): Promise<CompetitorsListResponse> {
    const competitorsApi = this.getCompetitorsApi();

    try {
      const response = await competitorsApi.productsByProductCompetitorsGet({ productId });
      return response.data as unknown as CompetitorsListResponse;
    } catch (error) {
      log.error('Error listing competitors for product', error as Error, { operation: 'listCompetitors', product_id: productId });
      throw error;
    }
  }

  // ============================
  // RELATIONSHIP/ASSOCIATION METHODS
  // ============================

  /**
   * Associate a feature with an epic
   * @param featureId The ID of the feature
   * @param epicId The ID or name of the epic
   * @returns The updated feature response
   */
  public static async associateFeatureWithEpic(featureId: string, epicId: string): Promise<Feature> {
    const featuresApi = this.getFeaturesApi();

    try {
      const response = await featuresApi.featuresByIdPut({
        id: featureId,
        featuresPutRequest: {
          feature: {
            epic: epicId
          }
        }
      });
      const data = response.data as unknown as { feature?: Feature };
      return data.feature as Feature;
    } catch (error) {
      log.error('Error associating feature with epic', error as Error, { operation: 'associateFeatureWithEpic', feature_id: featureId, epic_id: epicId });
      throw error;
    }
  }

  /**
   * Move a feature to a different release
   * @param featureId The ID of the feature
   * @param releaseId The ID or key of the target release
   * @returns The updated feature response
   */
  public static async moveFeatureToRelease(featureId: string, releaseId: string): Promise<Feature> {
    const featuresApi = this.getFeaturesApi();

    try {
      const response = await featuresApi.featuresByIdPut({
        id: featureId,
        featuresPutRequest: {
          feature: {
            release: releaseId
          }
        }
      });
      const data = response.data as unknown as { feature?: Feature };
      return data.feature as Feature;
    } catch (error) {
      log.error('Error moving feature to release', error as Error, { operation: 'moveFeatureToRelease', feature_id: featureId, release_id: releaseId });
      throw error;
    }
  }

  /**
   * Associate a feature with multiple goals
   * @param featureId The ID of the feature
   * @param goalIds Array of goal IDs to associate with the feature
   * @returns The updated feature response
   */
  public static async associateFeatureWithGoals(featureId: string, goalIds: number[]): Promise<Feature> {
    const featuresApi = this.getFeaturesApi();

    try {
      const response = await featuresApi.featuresByIdPut({
        id: featureId,
        featuresPutRequest: {
          feature: {
            goals: goalIds
          }
        }
      });
      const data = response.data as unknown as { feature?: Feature };
      return data.feature as Feature;
    } catch (error) {
      log.error('Error associating feature with goals', error as Error, { operation: 'associateFeatureWithGoals', feature_id: featureId, goal_ids: goalIds });
      throw error;
    }
  }

  /**
   * Update feature tags (metadata association)
   * @param featureId The ID of the feature
   * @param tags Array of tag strings to associate with the feature
   * @returns The updated feature response
   */
  public static async updateFeatureTags(featureId: string, tags: string[]): Promise<Feature> {
    const featuresApi = this.getFeaturesApi();

    try {
      const response = await featuresApi.featuresByIdPut({
        id: featureId,
        featuresPutRequest: {
          feature: {
            tags: tags
          }
        }
      });
      const data = response.data as unknown as { feature?: Feature };
      return data.feature as Feature;
    } catch (error) {
      log.error('Error updating tags for feature', error as Error, { operation: 'updateFeatureTags', feature_id: featureId });
      throw error;
    }
  }

  /**
   * Create an epic within a specific product
   * @param productId The ID of the product
   * @param epicData The epic data to create
   * @returns The created epic response
   */
  public static async createEpicInProduct(productId: string, epicData: any): Promise<Epic> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.productsByProductEpicsPost({
        productId: productId,
        epicsPostRequest: epicData
      });
      const data = response.data as unknown as { epic?: Epic };
      return data.epic as Epic;
    } catch (error) {
      log.error('Error creating epic in product', error as Error, { operation: 'createEpicInProduct', product_id: productId });
      throw error;
    }
  }

  /**
   * Create an epic within a specific release
   * @param releaseId The ID of the release
   * @param epicData The epic data to create
   * @returns The created epic response
   */
  public static async createEpicInRelease(releaseId: string, epicData: any): Promise<Epic> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.releasesByReleaseEpicsPost({
        releaseId: releaseId,
        epicsPostRequest: epicData
      });
      const data = response.data as unknown as { epic?: Epic };
      return data.epic as Epic;
    } catch (error) {
      log.error('Error creating epic in release', error as Error, { operation: 'createEpicInRelease', release_id: releaseId });
      throw error;
    }
  }

  /**
   * Create an initiative within a specific product
   * @param productId The ID of the product
   * @param initiativeData The initiative data to create
   * @returns The created initiative response
   */
  public static async createInitiativeInProduct(productId: string, initiativeData: any): Promise<InitiativeResponse> {
    const initiativesApi = this.getInitiativesApi();

    try {
      const response = await initiativesApi.productsByProductInitiativesPost({
        productId: productId,
        initiativesPostRequest: initiativeData
      });
      return response.data as unknown as InitiativeResponse;
    } catch (error) {
      log.error('Error creating initiative in product', error as Error, { operation: 'createInitiativeInProduct', product_id: productId });
      throw error;
    }
  }

  // ============================
  // FEATURE CRUD OPERATIONS (PHASE 8A.1)
  // ============================

  /**
   * Create a feature within a specific release
   * @param releaseId The ID of the release
   * @param featureData The feature data to create
   * @returns The created feature response, if the endpoint returned a body
   *
   * `unknown` rather than `Feature`: aha-js types this endpoint's response loosely, so
   * whatever Aha sends back is undeclared. The tool treats a missing body as an empty
   * record rather than assuming a feature came back.
   */
  public static async createFeature(releaseId: string, featureData: any): Promise<unknown> {
    const featuresApi = this.getFeaturesApi();

    // Aha documents the body as `{"feature": {...}}`, so tolerate either shape from callers:
    // the tool's schema sends it already wrapped, but a bare record from a direct caller
    // should not post an unwrapped body Aha will quietly do nothing with.
    // https://www.aha.io/api/resources/features/create_a_feature
    const payload = featureData?.feature ? featureData : { feature: featureData ?? {} };

    try {
      const response = await featuresApi.releasesByReleaseFeaturesPost({
        releaseId: releaseId,
        featuresPostRequest: payload
      });
      return response.data;
    } catch (error) {
      log.error('Error creating feature in release', error as Error, { operation: 'createFeature', release_id: releaseId });
      throw error;
    }
  }

  /**
   * Update a feature
   * @param featureId The ID of the feature
   * @param featureData The feature data to update
   * @returns The updated feature response
   */
  public static async updateFeature(featureId: string, featureData: any): Promise<Feature> {
    const featuresApi = this.getFeaturesApi();

    try {
      const response = await featuresApi.featuresByIdPut({
        id: featureId,
        featuresPutRequest: featureData
      });
      const data = response.data as unknown as { feature?: Feature };
      return data.feature as Feature;
    } catch (error) {
      log.error('Error updating feature', error as Error, { operation: 'updateFeature', feature_id: featureId });
      throw error;
    }
  }

  /**
   * Delete a feature
   * @param featureId The ID of the feature
   * @returns Success response
   */
  public static async deleteFeature(featureId: string): Promise<void> {
    const featuresApi = this.getFeaturesApi();

    try {
      await featuresApi.featuresByIdDelete({ id: featureId });
    } catch (error) {
      log.error('Error deleting feature', error as Error, { operation: 'deleteFeature', feature_id: featureId });
      throw error;
    }
  }

  /**
   * Update a feature's progress
   * @param featureId The ID of the feature
   * @param progress The progress percentage (0-100)
   * @returns The updated feature response
   */
  public static async updateFeatureProgress(featureId: string, progress: number): Promise<Feature> {
    const featuresApi = this.getFeaturesApi();

    try {
      const response = await featuresApi.featuresByIdPut({
        id: featureId,
        featuresPutRequest: {
          feature: {
            progress: progress
          }
        }
      });
      const data = response.data as unknown as { feature?: Feature };
      return data.feature as Feature;
    } catch (error) {
      log.error('Error updating progress for feature', error as Error, { operation: 'updateFeatureProgress', feature_id: featureId });
      throw error;
    }
  }

  /**
   * Update a feature's score
   * @param featureId The ID of the feature
   * @param score The score value
   * @returns The updated feature response
   */
  public static async updateFeatureScore(featureId: string, score: number): Promise<Feature> {
    const featuresApi = this.getFeaturesApi();

    try {
      const response = await featuresApi.featuresByIdPut({
        id: featureId,
        featuresPutRequest: {
          feature: {
            // Note: Need to check exact structure for score updates
            score_facts: [{ value: score }]
          }
        }
      });
      const data = response.data as unknown as { feature?: Feature };
      return data.feature as Feature;
    } catch (error) {
      log.error('Error updating score for feature', error as Error, { operation: 'updateFeatureScore', feature_id: featureId });
      throw error;
    }
  }

  /**
   * Update a feature's custom fields
   * @param featureId The ID of the feature
   * @param customFields Object of custom field key/value pairs
   * @returns The updated feature response
   */
  public static async updateFeatureCustomFields(featureId: string, customFields: Record<string, any>): Promise<Feature> {
    const featuresApi = this.getFeaturesApi();

    try {
      // This used to call a generated operation whose signature took an id and nothing
      // else - the operation was declared without a request body, so the values could not be
      // sent at all and every call was a no-op reported as success. `PUT /features/:id`
      // carries `feature.custom_fields`, so route through that instead.
      const response = await featuresApi.featuresByIdPut({
        id: featureId,
        featuresPutRequest: {
          feature: { custom_fields: customFields } as any
        }
      });
      const data = response.data as unknown as { feature?: Feature };
      return data.feature as Feature;
    } catch (error) {
      log.error('Error updating custom fields for feature', error as Error, { operation: 'updateFeatureCustomFields', feature_id: featureId });
      throw error;
    }
  }

  // ============================
  // EPIC CRUD OPERATIONS (PHASE 8A.2)
  // ============================

  /**
   * Update an epic
   * @param epicId The ID of the epic
   * @param epicData The epic data to update
   * @returns The updated epic response
   */
  public static async updateEpic(epicId: string, epicData: any): Promise<Epic> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.epicsByIdPut({
        id: epicId,
        epicsPostRequest: epicData
      });
      const data = response.data as unknown as { epic?: Epic };
      return data.epic as Epic;
    } catch (error) {
      log.error('Error updating epic', error as Error, { operation: 'updateEpic', epic_id: epicId });
      throw error;
    }
  }

  /**
   * Delete an epic
   * @param epicId The ID of the epic
   * @returns Success response
   */
  public static async deleteEpic(epicId: string): Promise<void> {
    const epicsApi = this.getEpicsApi();

    try {
      await epicsApi.epicsByIdDelete({ id: epicId });
    } catch (error) {
      log.error('Error deleting epic', error as Error, { operation: 'deleteEpic', epic_id: epicId });
      throw error;
    }
  }

  // ============================
  // IDEA CRUD OPERATIONS (PHASE 8A.3)
  // ============================

  /**
   * Create an idea in a product
   * @param productId The ID of the product
   * @param ideaData The idea data to create
   * @returns The created idea response
   */
  public static async createIdea(productId: string, ideaData: any): Promise<IdeaResponse> {
    const ideasApi = this.getIdeasApi();

    try {
      const response = await ideasApi.productsByProductIdeasPost({
        productId: productId,
        ideasPostRequest: ideaData
      });
      return response.data as unknown as IdeaResponse;
    } catch (error) {
      log.error('Error creating idea in product', error as Error, { operation: 'createIdea', product_id: productId });
      throw error;
    }
  }

  /**
   * Create an idea with a category in a product
   * @param productId The ID of the product
   * @param ideaData The idea data to create
   * @returns The created idea response
   */
  public static async createIdeaWithCategory(productId: string, ideaData: any): Promise<IdeaResponse> {
    try {
      // Use direct API call since this specific method might not be available in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/products/${productId}/ideas`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ideaData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create idea with category: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      log.error('Error creating idea with category in product', error as Error, { operation: 'createIdeaWithCategory', product_id: productId });
      throw error;
    }
  }

  /**
   * Create an idea with a score in a product
   * @param productId The ID of the product
   * @param ideaData The idea data to create
   * @returns The created idea response
   */
  public static async createIdeaWithScore(productId: string, ideaData: any): Promise<IdeaResponse> {
    try {
      // Use direct API call since this specific method might not be available in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/products/${productId}/ideas`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ideaData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create idea with score: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      log.error('Error creating idea with score in product', error as Error, { operation: 'createIdeaWithScore', product_id: productId });
      throw error;
    }
  }

  /**
   * Delete an idea
   * @param ideaId The ID of the idea
   * @returns Success response
   */
  public static async deleteIdea(ideaId: string): Promise<void> {
    const ideasApi = this.getIdeasApi();

    try {
      await ideasApi.ideasByIdDelete({ id: ideaId });
    } catch (error) {
      log.error('Error deleting idea', error as Error, { operation: 'deleteIdea', idea_id: ideaId });
      throw error;
    }
  }

  // COMPETITOR CRUD OPERATIONS (PHASE 8B.1)

  /**
   * Create a competitor in a product
   * @param productId The ID of the product
   * @param competitorData The competitor data to create
   * @returns The created competitor
   */
  public static async createCompetitor(productId: string, competitorData: any): Promise<Competitor> {
    const competitorsApi = this.getCompetitorsApi();

    try {
      const response = await competitorsApi.productsByProductCompetitorsPost({
        productId: productId,
        competitorsPostRequest: competitorData
      });
      const data = response.data as unknown as { competitor?: Competitor };
      return data.competitor as Competitor;
    } catch (error) {
      log.error('Error creating competitor in product', error as Error, { operation: 'createCompetitor', product_id: productId });
      throw error;
    }
  }

  /**
   * `PUT /competitors/{id}` and `DELETE /competitors/{id}` are documented by Aha but absent
   * from the OpenAPI document this SDK is generated from, so `CompetitorsApi` has no method
   * for either (only the product-scoped `PUT/DELETE /products/{id}/competitors/{id}`, which
   * needs a product id this service's callers do not have). Call them directly instead, the
   * same way `aha-graphql.ts` reaches endpoints aha-js does not cover: read credentials
   * through `getCredentials()` so a runtime `configure_server` call is honoured, and build
   * the request against the same `/api/v1` base path used everywhere else in this class.
   */
  private static async competitorRequest(
    method: 'PUT' | 'DELETE',
    competitorId: string,
    body?: unknown
  ): Promise<unknown> {
    const { subdomain, accessToken } = this.getCredentials();
    if (!subdomain || !accessToken) {
      throw new Error(
        'Aha API client not initialized. Set AHA_COMPANY and AHA_TOKEN, or call initialize().'
      );
    }

    const url = `https://${subdomain}.aha.io/api/v1/competitors/${competitorId}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      // Shaped like the axios errors every SDK-backed call in this class throws, so
      // `describeAhaError` maps the status the same way it would for those.
      const error = new Error(`Aha.io competitor request failed (HTTP ${response.status})`) as Error & {
        isAxiosError: boolean;
        response: { status: number; headers: Record<string, string> };
      };
      error.isAxiosError = true;
      error.response = { status: response.status, headers: Object.fromEntries(response.headers.entries()) };
      throw error;
    }

    if (response.status === 204) return undefined;
    return response.json().catch(() => undefined);
  }

  /**
   * Update a competitor
   * @param competitorId The ID of the competitor
   * @param competitorData The competitor data to update
   * @returns The updated competitor
   */
  public static async updateCompetitor(competitorId: string, competitorData: any): Promise<Competitor> {
    try {
      const data = await this.competitorRequest('PUT', competitorId, competitorData);
      const wrapped = data as { competitor?: Competitor } | null | undefined;
      return (wrapped?.competitor ?? (data as Competitor)) as Competitor;
    } catch (error) {
      log.error('Error updating competitor', error as Error, { operation: 'updateCompetitor', competitor_id: competitorId });
      throw error;
    }
  }

  /**
   * Delete a competitor
   * @param competitorId The ID of the competitor
   * @returns Success response
   */
  public static async deleteCompetitor(competitorId: string): Promise<void> {
    try {
      await this.competitorRequest('DELETE', competitorId);
    } catch (error) {
      log.error('Error deleting competitor', error as Error, { operation: 'deleteCompetitor', competitor_id: competitorId });
      throw error;
    }
  }

  // INITIATIVE ENHANCEMENT OPERATIONS (PHASE 8B.2)

  /**
   * Get epics associated with an initiative
   * @param initiativeId The ID of the initiative
   * @returns A list of epics associated with the initiative
   */
  public static async getInitiativeEpics(initiativeId: string): Promise<EpicsListResponse> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.initiativesByInitiativeEpicsGet({ initiativeId });
      return response.data as unknown as EpicsListResponse;
    } catch (error) {
      log.error('Error getting epics for initiative', error as Error, { operation: 'getInitiativeEpics', initiative_id: initiativeId });
      throw error;
    }
  }

  // PORTAL INTEGRATION & ADVANCED FEATURES (PHASE 8C)

  /**
   * Create an idea by a portal user
   * @param productId The ID of the product
   * @param ideaData The idea data with portal user information
   * @returns The created idea response
   */
  public static async createIdeaByPortalUser(productId: string, ideaData: any): Promise<IdeaResponse> {
    try {
      // Use direct API call since this specific method might not be available in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/products/${productId}/ideas`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ideaData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create idea by portal user: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      log.error('Error creating idea by portal user in product', error as Error, { operation: 'createIdeaByPortalUser', product_id: productId });
      throw error;
    }
  }

  /**
   * Create an idea with enhanced portal settings
   * @param productId The ID of the product
   * @param ideaData The idea data with portal configuration
   * @returns The created idea response
   */
  public static async createIdeaWithPortalSettings(productId: string, ideaData: any): Promise<IdeaResponse> {
    const ideasApi = this.getIdeasApi();

    try {
      const response = await ideasApi.productsByProductIdeasPost({
        productId: productId,
        ideasPostRequest: ideaData
      });
      return response.data as unknown as IdeaResponse;
    } catch (error) {
      log.error('Error creating idea with portal settings in product', error as Error, { operation: 'createIdeaWithPortalSettings', product_id: productId });
      throw error;
    }
  }

  // Strategic Models methods
  /**
   * Get a strategic model by ID
   * @param strategicModelId The ID of the strategic model
   * @returns The strategic model data
   */
  public static async getStrategicModel(strategicModelId: string): Promise<StrategicModel> {
    const strategicModelsApi = this.getStrategicModelsApi();
    try {
      // Aha renamed `/strategic_models` to `/strategy_models` upstream; the response field
      // followed suit (`strategy_model` rather than the old `strategic_model`).
      const response = await strategicModelsApi.strategyModelsByIdGet({ id: strategicModelId });
      const data = response.data as unknown as { strategy_model?: StrategicModel };
      if (!data.strategy_model) {
        throw new Error(`Strategic model ${strategicModelId} not found`);
      }
      return data.strategy_model;
    } catch (error) {
      log.error('Error getting strategic model', error as Error, { operation: 'getStrategicModel', strategic_model_id: strategicModelId });
      throw error;
    }
  }

  /**
   * List strategic models
   * @param query Search query (optional)
   * @param type Filter by type (optional)
   * @param updatedSince Filter by update date (optional)
   * @param page Page number for pagination (optional)
   * @param perPage Number of items per page (max 200) (optional)
   * @returns The list of strategic models
   */
  public static async listStrategicModels(
    query?: string,
    type?: string,
    updatedSince?: string,
    page?: number,
    perPage?: number
  ): Promise<StrategicModelsListResponse> {
    const strategicModelsApi = this.getStrategicModelsApi();
    try {
      // `strategyModelsGet`'s generated request type only documents pagination now; `q`,
      // `type` and `updatedSince` are sent via `options.params` because Aha's spec
      // under-documents this endpoint's query string. The response type is also a generator
      // defect: it is shared with the by-id endpoint and shaped `{ strategy_model }`
      // (singular); the real list endpoint returns an array. The exact plural field name
      // post-rename is unconfirmed, so both `strategic_models` (the pre-rename name the
      // domain type uses) and `strategy_models` are checked.
      const response = await strategicModelsApi.strategyModelsGet(
        {
          page: this.numParam(page),
          perPage: this.numParam(perPage)
        },
        { params: this.extraParams({ q: query, type, updated_since: updatedSince }) }
      );
      const data = response.data as unknown as {
        strategic_models?: StrategicModel[];
        strategy_models?: StrategicModel[];
        pagination?: Pagination;
      };
      return {
        strategic_models: data.strategic_models ?? data.strategy_models ?? [],
        pagination: data.pagination
      };
    } catch (error) {
      log.error('Error listing strategic models', error as Error, { operation: 'listStrategicModels' });
      throw error;
    }
  }

  // To-dos list method
  /**
   * List to-dos
   * @returns The list of to-dos
   */
  public static async listTodos(): Promise<TodosListResponse> {
    const todosApi = this.getTodosApi();
    try {
      const response = await todosApi.tasksGet();
      return response.data as unknown as TodosListResponse;
    } catch (error) {
      log.error('Error listing todos', error as Error, { operation: 'listTodos' });
      throw error;
    }
  }

  // Idea Organizations methods
  /**
   * Get an idea organization by ID
   * @param ideaOrganizationId The ID of the idea organization
   * @returns The idea organization data
   */
  public static async getIdeaOrganization(ideaOrganizationId: string): Promise<IdeaOrganization> {
    const ideaOrganizationsApi = this.getIdeaOrganizationsApi();
    try {
      const response = await ideaOrganizationsApi.ideaOrganizationsByIdGet({ id: ideaOrganizationId });
      const data = response.data as unknown as { idea_organization?: IdeaOrganization };
      if (!data.idea_organization) {
        throw new Error(`Idea organization ${ideaOrganizationId} not found`);
      }
      return data.idea_organization;
    } catch (error) {
      log.error('Error getting idea organization', error as Error, { operation: 'getIdeaOrganization', idea_organization_id: ideaOrganizationId });
      throw error;
    }
  }

  /**
   * List idea organizations
   * @param query Search query (optional)
   * @param emailDomain Filter by email domain (optional)
   * @param page Page number for pagination (optional)
   * @param perPage Number of items per page (max 200) (optional)
   * @returns The list of idea organizations
   */
  public static async listIdeaOrganizations(
    query?: string,
    emailDomain?: string,
    page?: number,
    perPage?: number
  ): Promise<IdeaOrganizationsListResponse> {
    const ideaOrganizationsApi = this.getIdeaOrganizationsApi();
    try {
      // `q` and `emailDomain` are sent via `options.params` because Aha's spec
      // under-documents this endpoint's query string - the generated request type has no
      // such fields. Its response type is also a generator defect: shared with the by-id
      // endpoint and shaped `{ idea_organization }` (singular). The real list endpoint
      // returns `{ idea_organizations, pagination }`.
      const response = await ideaOrganizationsApi.ideaOrganizationsGet(
        {
          page: this.numParam(page),
          perPage: this.numParam(perPage)
        },
        { params: this.extraParams({ q: query, email_domain: emailDomain }) }
      );
      const data = response.data as unknown as { idea_organizations?: IdeaOrganization[]; pagination?: Pagination };
      return { idea_organizations: data.idea_organizations ?? [], pagination: data.pagination };
    } catch (error) {
      log.error('Error listing idea organizations', error as Error, { operation: 'listIdeaOrganizations' });
      throw error;
    }
  }

  // Me/Current User methods
  /**
   * Get assigned records for the current user
   * @returns The assigned records for the current user
   */
  public static async getAssignedRecords(): Promise<MeAssignedRecordsResponse> {
    const meApi = this.getMeApi();
    try {
      const response = await meApi.meAssignedGet();
      // Generator defect: `meAssignedGet` shares its response type with `meTasksGet`
      // (`{ tasks, pagination }`); the endpoint genuinely returns `{ records, pagination }`.
      const data = response.data as unknown as { records?: RecordRef[]; pagination?: Pagination };
      return { records: data.records ?? [], pagination: data.pagination };
    } catch (error) {
      log.error('Error getting assigned records', error as Error, { operation: 'getMeAssignedRecords' });
      throw error;
    }
  }

  /**
   * Get pending tasks for the current user
   * @returns The pending tasks for the current user
   */
  public static async getPendingTasks(): Promise<MePendingTasksResponse> {
    const meApi = this.getMeApi();
    try {
      const response = await meApi.meTasksGet();
      return response.data as unknown as MePendingTasksResponse;
    } catch (error) {
      log.error('Error getting pending tasks', error as Error, { operation: 'getMePendingTasks' });
      throw error;
    }
  }

  // Idea Endorsements/Votes methods
  /**
   * Get endorsements for an idea
   * @param ideaId The ID of the idea
   * @param proxy If set to true, only returns proxy votes (optional)
   * @param page Page number for pagination (optional)
   * @param perPage Number of endorsements per page (optional)
   * @returns The endorsements for the idea
   */
  public static async getIdeaEndorsements(
    ideaId: string,
    proxy?: boolean,
    page?: number,
    perPage?: number
  ): Promise<IdeaEndorsementsResponse> {
    const ideasApi = this.getIdeaVotesApi();
    try {
      const response = await ideasApi.ideasByIdeaEndorsementsGet({
        ideaId: ideaId,
        proxy: this.boolParam(proxy),
        page: this.numParam(page),
        perPage: this.numParam(perPage)
      });
      return response.data as unknown as IdeaEndorsementsResponse;
    } catch (error) {
      log.error('Error getting endorsements for idea', error as Error, { operation: 'getIdeaEndorsements', idea_id: ideaId });
      throw error;
    }
  }

  /**
   * Get votes for an idea
   * @param ideaId The ID of the idea
   * @param page Page number for pagination (optional)
   * @param perPage Number of votes per page (optional)
   * @returns The votes for the idea
   */
  public static async getIdeaVotes(
    ideaId: string,
    page?: number,
    perPage?: number
  ): Promise<IdeaVotesResponse> {
    // Aha models votes and endorsements as the same underlying record; there is no separate
    // `/ideas/{id}/votes` endpoint in the generated SDK, so this calls the same operation as
    // `getIdeaEndorsements`.
    const ideaVotesApi = this.getIdeaVotesApi();
    try {
      const response = await ideaVotesApi.ideasByIdeaEndorsementsGet({
        ideaId: ideaId,
        page: this.numParam(page),
        perPage: this.numParam(perPage)
      });
      return response.data as unknown as IdeaVotesResponse;
    } catch (error) {
      log.error('Error getting votes for idea', error as Error, { operation: 'getIdeaVotes', idea_id: ideaId });
      throw error;
    }
  }

  // Additional missing methods for new resources
  /**
   * List all ideas globally (not product-specific)
   * @param query Search query (optional)
   * @param updatedSince Filter by update date (optional)
   * @param assignedToUser Filter by assigned user (optional)
   * @param status Filter by status (optional)
   * @param category Filter by category (optional)
   * @param fields Comma-separated list of fields to include (optional)
   * @param page Page number for pagination (optional)
   * @param perPage Number of items per page (max 200) (optional)
   * @param productId Filter ideas by product ID (optional)
   * @param ideaPortalId Filter ideas by idea portal ID (optional)
   * @param spam Show/hide spam ideas (optional)
   * @param workflowStatus Filter by workflow status ID or name (optional)
   * @param sort Sorting option: recent, trending, or popular (optional)
   * @param createdBefore Filter by creation date before (optional)
   * @param createdSince Filter by creation date after (optional)
   * @param tag Filter by tag value (optional)
   * @param userId Filter by user who created the idea (optional)
   * @param ideaUserId Filter by idea user who created the idea (optional)
   * @returns The list of ideas
   */
  public static async listIdeas(
    query?: string,
    updatedSince?: string,
    assignedToUser?: string,
    status?: string,
    category?: string,
    fields?: string,
    page?: number,
    perPage?: number,
    productId?: string,
    ideaPortalId?: string,
    spam?: boolean,
    workflowStatus?: string,
    sort?: 'recent' | 'trending' | 'popular',
    createdBefore?: string,
    createdSince?: string,
    tag?: string,
    userId?: string,
    ideaUserId?: string
  ): Promise<IdeasListResponse> {
    const ideasApi = this.getIdeasApi();
    try {
      // `ideasGet`'s generated request type has no `status`, `category`, `productId`,
      // `ideaPortalId` or `ideaUserId` fields, so those are sent via `options.params` because
      // Aha's spec under-documents this endpoint's query string.
      const response = await ideasApi.ideasGet(
        {
          page: this.numParam(page),
          perPage: this.numParam(perPage),
          q: query,
          updatedSince,
          assignedToUser,
          workflowStatus,
          spam: this.boolParam(spam),
          sort,
          createdBefore,
          createdSince,
          tag,
          userId,
          fields
        },
        {
          params: this.extraParams({
            status,
            category,
            product_id: productId,
            idea_portal_id: ideaPortalId,
            idea_user_id: ideaUserId
          })
        }
      );
      return response.data as unknown as IdeasListResponse;
    } catch (error) {
      log.error('Error listing ideas', error as Error, { operation: 'listIdeas' });
      throw error;
    }
  }

  /**
   * List releases for a specific product
   * @param productId The ID of the product
   * @param query Search query (optional)
   * @param updatedSince Filter by update date (optional)
   * @param status Filter by status (optional)
   * @param parkingLot Filter by parking lot (optional)
   * @param page Page number for pagination (optional)
   * @param perPage Number of items per page (max 200) (optional)
   * @returns The list of releases for the product
   */
  public static async listReleasesByProduct(
    productId: string,
    query?: string,
    updatedSince?: string,
    status?: string,
    parkingLot?: boolean,
    page?: number,
    perPage?: number
  ): Promise<ReleasesListResponse> {
    const releasesApi = this.getReleasesApi();
    try {
      // `q`, `updatedSince`, `status` and `parkingLot` are sent via `options.params` because
      // Aha's spec under-documents this endpoint's query string - only pagination remains in
      // the generated request type.
      const response = await releasesApi.productsByProductReleasesGet(
        {
          productId,
          page: this.numParam(page),
          perPage: this.numParam(perPage)
        },
        {
          params: this.extraParams({
            q: query,
            updated_since: updatedSince,
            status,
            parking_lot: parkingLot
          })
        }
      );
      return response.data as unknown as ReleasesListResponse;
    } catch (error) {
      log.error('Error listing releases for product', error as Error, { operation: 'getProductReleases', product_id: productId });
      throw error;
    }
  }

  // ============================
  // CUSTOM FIELDS OPERATIONS
  // ============================

  /**
   * List all custom field definitions
   * @returns A list of custom field definitions
   */
  public static async listCustomFields(): Promise<CustomFieldDefinitionsResponse> {
    const customFieldsApi = this.getCustomFieldsApi();
    try {
      const response = await customFieldsApi.customFieldDefinitionsGet();
      // Generator defect: `customFieldDefinitionsGet` (list-all) shares its response type
      // with `...ByCustomFieldDefinitionOptionsGet` (`{ options }`), which is wrong for the
      // list-all case. Build the real `{ custom_field_definitions }` shape ourselves.
      const data = response.data as unknown as { custom_field_definitions?: CustomFieldDefinition[] };
      return { custom_field_definitions: data.custom_field_definitions ?? [] };
    } catch (error) {
      log.error('Error listing custom fields', error as Error, { operation: 'listCustomFields' });
      throw error;
    }
  }

  /**
   * List options for a specific custom field
   * @param customFieldDefinitionId The ID of the custom field definition
   * @returns A list of options for the custom field
   */
  public static async listCustomFieldOptions(customFieldDefinitionId: string): Promise<CustomFieldOptionsResponse> {
    const customFieldsApi = this.getCustomFieldsApi();
    try {
      const response = await customFieldsApi.customFieldDefinitionsByCustomFieldDefinitionOptionsGet({
        customFieldDefinitionId
      });
      return response.data as unknown as CustomFieldOptionsResponse;
    } catch (error) {
      log.error('Error listing custom field options', error as Error, { operation: 'listCustomFieldOptions', custom_field_definition_id: customFieldDefinitionId });
      throw error;
    }
  }
}
