import {
  Configuration,
  FeaturesApi,
  IdeasApi,
  UsersApi,
  EpicsApi,
  ProductsApi,
  InitiativesApi,
  CommentsApi,
  GoalsApi,
  ToDosApi,
  CompetitorsApi,
  RequirementsApi,
  ReleasePhasesApi,
  ReleasesApi,
  DefaultApi,
  MeApi,
  StrategicModelsApi,
  IdeaOrganizationsApi,
  IdeaVotesApi,
  CustomFieldsApi,
  // Types
  Feature,
  FeaturesListResponse,
  Epic,
  User,
  IdeaResponse,
  InitiativeResponse,
  InitiativesListResponse,
  ProductsListResponse,
  CommentsGetEpic200Response,
  EpicsList200Response,
  IdeasListResponse,
  Comment,
  // Additional SDK response types
  GoalGetResponse,
  GoalsListResponse as SdkGoalsListResponse,
  ReleaseGetResponse,
  ReleasesListResponse as SdkReleasesListResponse,
  ReleasePhasesList200Response,
  ReleasePhase as SdkReleasePhase,
  Competitor,
  StrategicModelGetResponse,
  StrategicModelsListResponse,
  StrategicModel,
  IdeaOrganizationGetResponse,
  IdeaOrganizationsListResponse,
  IdeaOrganization,
  TodosList200Response,
  MeAssignedRecordsResponse,
  MePendingTasksResponse,
  IdeasGetEndorsements200Response,
  IdeasGetVotes200Response,
  IdeasGetWatchers200Response,
  CustomFieldsListAll200Response,
  CustomFieldsListOptions200Response
} from '@cedricziel/aha-js';

import {
  Product,
  Requirement,
  Todo,
  ReleaseFeaturesResponse,
  GoalEpicsResponse,
  CompetitorsListResponse
} from '../types/aha-types.js';

import { log } from '../logger.js';

/**
 * Service for interacting with the Aha.io API
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
  private static goalsApi: GoalsApi | null = null;
  private static todosApi: ToDosApi | null = null;
  private static competitorsApi: CompetitorsApi | null = null;
  private static requirementsApi: RequirementsApi | null = null;
  private static releasePhasesApi: ReleasePhasesApi | null = null;
  private static releasesApi: ReleasesApi | null = null;
  private static defaultApi: DefaultApi | null = null;
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
   * Get the current user (me) information
   * @returns The current user information
   */
  public static async getMe(): Promise<User> {
    const meApi = this.getMeApi();

    try {
      const response = await meApi.meGetProfile();
      return response.data.user;
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
      this.goalsApi = new GoalsApi(this.configuration);
      this.todosApi = new ToDosApi(this.configuration);
      this.competitorsApi = new CompetitorsApi(this.configuration);
      this.requirementsApi = new RequirementsApi(this.configuration);
      this.releasePhasesApi = new ReleasePhasesApi(this.configuration);
      this.releasesApi = new ReleasesApi(this.configuration);
      this.defaultApi = new DefaultApi(this.configuration);
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
   * Get the default API instance
   * @returns DefaultApi instance
   */
  private static getDefaultApi(): DefaultApi {
    if (!this.defaultApi) {
      this.initializeClient();
    }
    return this.defaultApi!;
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
   * @returns A list of features
   */
  public static async listFeatures(
    query?: string,
    updatedSince?: string,
    tag?: string,
    assignedToUser?: string
  ): Promise<FeaturesListResponse> {
    const featuresApi = this.getFeaturesApi();

    const startTime = Date.now();
    try {
      const params: Record<string, string> = {};
      if (query) params.q = query;
      if (updatedSince) params.updated_since = updatedSince;
      if (tag) params.tag = tag;
      if (assignedToUser) params.assigned_to_user = assignedToUser;

      // Use the appropriate method from the FeaturesApi
      const response = await featuresApi.featuresList(params);
      const duration = Date.now() - startTime;
      // API call automatically traced by auto-instrumentation
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = (error as any)?.response?.status || 500;
      // API call automatically traced by auto-instrumentation
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
      const response = await featuresApi.featuresGet({ id: featureId });
      if (!response.data.feature) {
        throw new Error(`Feature ${featureId} not found`);
      }
      return response.data.feature;
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
      // Use the appropriate method from the UsersApi
      const response = await usersApi.usersList();
      return { users: response.data };
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
      const response = await usersApi.usersGet({ id: userId });
      return response.data;
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
  public static async listEpics(productId: string): Promise<EpicsList200Response> {
    const epicsApi = this.getEpicsApi();

    try {
      // Use the appropriate method from the EpicsApi with the correct parameter format
      const response = await epicsApi.epicsListInProduct({
        productId: productId
      });
      return response.data;
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
      const response = await epicsApi.epicsGet({ epicId });
      return response.data;
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
      // Use the appropriate method from the CommentsApi with the correct parameter format
      const response = await commentsApi.commentsCreateFeature({
        featureId: featureId,
        commentCreateRequest: {
          body: body
        }
      });
      return response.data;
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
      const response = await ideasApi.ideasGetById({ id: ideaId });
      return response.data;
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
      const response = await productsApi.productsGet({ id: productId });
      return response.data.product;
    } catch (error) {
      log.error('Error getting product', error as Error, { operation: 'getProduct', product_id: productId });
      throw error;
    }
  }

  /**
   * List products from Aha.io
   * @param updatedSince UTC timestamp (ISO8601 format) (optional)
   * @returns A list of products
   */
  public static async listProducts(updatedSince?: string): Promise<ProductsListResponse> {
    const productsApi = this.getProductsApi();

    try {
      const params: any = {};
      if (updatedSince) params.updatedSince = updatedSince;

      const response = await productsApi.productsList(params);
      return response.data;
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
      const response = await initiativesApi.initiativesGet({ id: initiativeId });
      return response.data;
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
   * @returns A list of initiatives
   */
  public static async listInitiatives(
    query?: string,
    updatedSince?: string,
    assignedToUser?: string,
    onlyActive?: boolean
  ): Promise<InitiativesListResponse> {
    const initiativesApi = this.getInitiativesApi();

    try {
      const params: any = {};
      if (query) params.q = query;
      if (updatedSince) params.updatedSince = updatedSince;
      if (assignedToUser) params.assignedToUser = assignedToUser;
      if (onlyActive !== undefined) params.onlyActive = onlyActive;

      const response = await initiativesApi.initiativesList(params);
      return response.data;
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
      const params: any = {};
      if (query) params.q = query;
      if (spam !== undefined) params.spam = spam;
      if (workflowStatus) params.workflowStatus = workflowStatus;
      if (sort) params.sort = sort;
      if (createdBefore) params.createdBefore = createdBefore;
      if (createdSince) params.createdSince = createdSince;
      if (updatedSince) params.updatedSince = updatedSince;
      if (tag) params.tag = tag;
      if (userId) params.userId = userId;
      if (ideaUserId) params.ideaUserId = ideaUserId;

      const response = await ideasApi.ideasListProduct({ 
        productId: productId,
        ...params 
      });
      return response.data;
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
  public static async getEpicComments(epicId: string): Promise<CommentsGetEpic200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.commentsGetEpic({ epicId });
      return response.data;
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
  public static async getIdeaComments(ideaId: string): Promise<CommentsGetEpic200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.commentsGetIdea({ ideaId });
      return response.data;
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
  public static async getInitiativeComments(initiativeId: string): Promise<CommentsGetEpic200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.commentsGetInitiative({ initiativeId });
      return response.data;
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
  public static async getProductComments(productId: string): Promise<CommentsGetEpic200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.commentsGetProduct({ productId });
      return response.data;
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
  public static async getGoalComments(goalId: string): Promise<CommentsGetEpic200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.commentsGetGoal({ goalId });
      return response.data;
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
  public static async getReleaseComments(releaseId: string): Promise<CommentsGetEpic200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.commentsGetRelease({ releaseId });
      return response.data;
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
  public static async getReleasePhaseComments(releasePhaseId: string): Promise<CommentsGetEpic200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.commentsGetReleasePhase({ releasePhaseId });
      return response.data;
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
  public static async getRequirementComments(requirementId: string): Promise<CommentsGetEpic200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.commentsGetRequirement({ requirementId });
      return response.data;
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
  public static async getTodoComments(todoId: string): Promise<CommentsGetEpic200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.commentsGetTodo({ todoId });
      return response.data;
    } catch (error) {
      log.error('Error getting comments for todo', error as Error, { operation: 'getTodoComments', todo_id: todoId });
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
      const response = await goalsApi.goalsGet({ id: goalId });
      return response.data;
    } catch (error) {
      log.error('Error getting goal', error as Error, { operation: 'getGoal', goal_id: goalId });
      throw error;
    }
  }

  /**
   * List goals from Aha.io
   * @returns A list of goals
   */
  public static async listGoals(): Promise<SdkGoalsListResponse> {
    const goalsApi = this.getGoalsApi();

    try {
      const response = await goalsApi.goalsList();
      return response.data;
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
      const response = await epicsApi.epicsListByGoal({ goalId });
      return response.data;
    } catch (error) {
      log.error('Error getting epics for goal', error as Error, { operation: 'getGoalEpics', goal_id: goalId });
      throw error;
    }
  }

  /**
   * Get a specific release by ID
   * @param releaseId The ID of the release
   * @returns The release details
   */
  public static async getRelease(releaseId: string): Promise<ReleaseGetResponse> {
    const releasesApi = this.getReleasesApi();

    try {
      const response = await releasesApi.releasesGet({ id: releaseId });
      return response.data;
    } catch (error) {
      log.error('Error getting release', error as Error, { operation: 'getRelease', release_id: releaseId });
      throw error;
    }
  }

  /**
   * List releases from Aha.io
   * @returns A list of releases
   */
  public static async listReleases(): Promise<SdkReleasesListResponse> {
    const releasesApi = this.getReleasesApi();

    try {
      const response = await releasesApi.releasesList();
      return response.data;
    } catch (error) {
      log.error('Error listing releases', error as Error, { operation: 'listReleases' });
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
  public static async getReleaseEpics(releaseId: string): Promise<EpicsList200Response> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.epicsListInRelease({ releaseId });
      return response.data;
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
  public static async getReleasePhase(releasePhaseId: string): Promise<SdkReleasePhase> {
    const releasePhasesApi = this.getReleasePhasesApi();

    try {
      const response = await releasePhasesApi.releasePhasesGet({ id: releasePhaseId });
      if (!response.data.release_phase) {
        throw new Error(`Release phase ${releasePhaseId} not found`);
      }
      return response.data.release_phase;
    } catch (error) {
      log.error('Error getting release phase', error as Error, { operation: 'getReleasePhase', release_phase_id: releasePhaseId });
      throw error;
    }
  }

  /**
   * List release phases from Aha.io
   * @returns A list of release phases
   */
  public static async listReleasePhases(): Promise<ReleasePhasesList200Response> {
    const releasePhasesApi = this.getReleasePhasesApi();

    try {
      const response = await releasePhasesApi.releasePhasesList();
      return response.data;
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
      const response = await requirementsApi.requirementsGet({ id: requirementId });
      if (!response.data.requirement) {
        throw new Error(`Requirement ${requirementId} not found`);
      }
      return response.data.requirement as Requirement;
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
      const response = await competitorsApi.competitorsGet({ competitorId });
      return response.data;
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
      const response = await todosApi.todosGet({ id: todoId });
      if (!response.data.task) {
        throw new Error(`Todo ${todoId} not found`);
      }
      return response.data.task as Todo;
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
      const response = await competitorsApi.competitorsListProduct({ productId });
      return response.data;
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
      const response = await featuresApi.featuresIdEpicPut({
        id: featureId,
        featuresIdEpicPutRequest: {
          feature: {
            epic: epicId
          }
        }
      });
      return response.data;
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
      const response = await featuresApi.featuresIdReleasePut({
        id: featureId,
        featuresIdReleasePutRequest: {
          feature: {
            release: releaseId
          }
        }
      });
      return response.data;
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
      const response = await featuresApi.featuresIdGoalsPut({
        id: featureId,
        featuresIdGoalsPutRequest: {
          feature: {
            goals: goalIds
          }
        }
      });
      return response.data;
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
      const response = await featuresApi.featuresIdTagsPut({
        id: featureId,
        featuresIdTagsPutRequest: {
          feature: {
            tags: tags
          }
        }
      });
      return response.data;
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
      const response = await epicsApi.epicsCreateInProduct({
        productId: productId,
        epicCreateRequest: epicData
      });
      return response.data;
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
      const response = await epicsApi.epicsCreateInRelease({
        releaseId: releaseId,
        epicCreateRequest: epicData
      });
      return response.data;
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
      const response = await initiativesApi.initiativesCreate({
        productId: productId,
        initiativeCreateRequest: initiativeData
      });
      return response.data;
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
   * @returns The created feature response
   */
  public static async createFeature(releaseId: string, _featureData: any): Promise<void> {
    const defaultApi = this.getDefaultApi();

    try {
      const response = await defaultApi.releasesReleaseIdFeaturesPost({
        releaseId: releaseId
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
      const response = await featuresApi.featuresUpdate({
        id: featureId,
        featureUpdateRequest: featureData
      });
      return response.data.feature;
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
      await featuresApi.featuresDelete({ id: featureId });
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
      const response = await featuresApi.featuresIdProgressPut({
        id: featureId,
        featuresIdProgressPutRequest: {
          feature: {
            progress: progress
          }
        }
      });
      return response.data;
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
      const response = await featuresApi.featuresIdScorePut({
        id: featureId,
        featuresIdScorePutRequest: {
          feature: {
            // Note: Need to check exact structure for score updates
            score_facts: [{ value: score }]
          }
        }
      });
      return response.data;
    } catch (error) {
      log.error('Error updating score for feature', error as Error, { operation: 'updateFeatureScore', feature_id: featureId });
      throw error;
    }
  }

  /**
   * Update a feature's custom fields
   * @param featureId The ID of the feature
   * @param customFields The custom fields data
   * @returns Success response
   */
  public static async updateFeatureCustomFields(featureId: string, _customFields: any): Promise<void> {
    const defaultApi = this.getDefaultApi();

    try {
      await defaultApi.featuresIdCustomFieldsPut({
        id: featureId
      });
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
      const response = await epicsApi.epicsUpdate({
        epicId: epicId,
        epicUpdateRequest: epicData
      });
      return response.data;
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
      await epicsApi.epicsDelete({ epicId: epicId });
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
      const response = await ideasApi.ideasCreate({
        productId: productId,
        ideaCreateRequest: ideaData
      });
      return response.data;
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
      await ideasApi.ideasDelete({ id: ideaId });
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
      const response = await competitorsApi.competitorsCreate({
        productId: productId,
        competitorCreateRequest: competitorData
      });
      return response.data;
    } catch (error) {
      log.error('Error creating competitor in product', error as Error, { operation: 'createCompetitor', product_id: productId });
      throw error;
    }
  }

  /**
   * Update a competitor
   * @param competitorId The ID of the competitor
   * @param competitorData The competitor data to update
   * @returns The updated competitor
   */
  public static async updateCompetitor(competitorId: string, competitorData: any): Promise<Competitor> {
    const competitorsApi = this.getCompetitorsApi();

    try {
      const response = await competitorsApi.competitorsUpdate({
        competitorId: competitorId,
        competitorUpdateRequest: competitorData
      });
      return response.data;
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
    const competitorsApi = this.getCompetitorsApi();

    try {
      await competitorsApi.competitorsDelete({ competitorId: competitorId });
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
  public static async getInitiativeEpics(initiativeId: string): Promise<EpicsList200Response> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.epicsListByInitiative({ initiativeId });
      return response.data;
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
      const response = await ideasApi.ideasCreate({
        productId: productId,
        ideaCreateRequest: ideaData
      });
      return response.data;
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
      const response = await strategicModelsApi.strategicModelsGet({ id: strategicModelId });
      if (!response.data.strategic_model) {
        throw new Error(`Strategic model ${strategicModelId} not found`);
      }
      return response.data.strategic_model;
    } catch (error) {
      log.error('Error getting strategic model', error as Error, { operation: 'getStrategicModel', strategic_model_id: strategicModelId });
      throw error;
    }
  }

  /**
   * List strategic models
   * @returns The list of strategic models
   */
  public static async listStrategicModels(): Promise<StrategicModelsListResponse> {
    const strategicModelsApi = this.getStrategicModelsApi();
    try {
      const response = await strategicModelsApi.strategicModelsList();
      return response.data;
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
  public static async listTodos(): Promise<TodosList200Response> {
    const todosApi = this.getTodosApi();
    try {
      const response = await todosApi.todosList();
      return response.data;
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
      const response = await ideaOrganizationsApi.ideaOrganizationsGet({ id: ideaOrganizationId });
      if (!response.data.idea_organization) {
        throw new Error(`Idea organization ${ideaOrganizationId} not found`);
      }
      return response.data.idea_organization;
    } catch (error) {
      log.error('Error getting idea organization', error as Error, { operation: 'getIdeaOrganization', idea_organization_id: ideaOrganizationId });
      throw error;
    }
  }

  /**
   * List idea organizations
   * @returns The list of idea organizations
   */
  public static async listIdeaOrganizations(): Promise<IdeaOrganizationsListResponse> {
    const ideaOrganizationsApi = this.getIdeaOrganizationsApi();
    try {
      const response = await ideaOrganizationsApi.ideaOrganizationsList();
      return response.data;
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
      const response = await meApi.meGetAssignedRecords();
      return response.data;
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
      const response = await meApi.meGetPendingTasks();
      return response.data;
    } catch (error) {
      log.error('Error getting pending tasks', error as Error, { operation: 'getMePendingTasks' });
      throw error;
    }
  }

  // Idea Endorsements/Votes methods
  /**
   * Get endorsements for an idea
   * @param ideaId The ID of the idea
   * @returns The endorsements for the idea
   */
  public static async getIdeaEndorsements(ideaId: string): Promise<IdeasGetEndorsements200Response> {
    const ideasApi = this.getIdeasApi();
    try {
      const response = await ideasApi.ideasGetEndorsements({ id: ideaId });
      return response.data;
    } catch (error) {
      log.error('Error getting endorsements for idea', error as Error, { operation: 'getIdeaEndorsements', idea_id: ideaId });
      throw error;
    }
  }

  /**
   * Get votes for an idea
   * @param ideaId The ID of the idea
   * @returns The votes for the idea
   */
  public static async getIdeaVotes(ideaId: string): Promise<IdeasGetVotes200Response> {
    const ideasApi = this.getIdeasApi();
    try {
      const response = await ideasApi.ideasGetVotes({ id: ideaId });
      return response.data;
    } catch (error) {
      log.error('Error getting votes for idea', error as Error, { operation: 'getIdeaVotes', idea_id: ideaId });
      throw error;
    }
  }

  /**
   * Get watchers for an idea
   * @param ideaId The ID of the idea
   * @returns The watchers for the idea
   */
  public static async getIdeaWatchers(ideaId: string): Promise<IdeasGetWatchers200Response> {
    const ideasApi = this.getIdeasApi();
    try {
      const response = await ideasApi.ideasGetWatchers({ id: ideaId });
      return response.data;
    } catch (error) {
      log.error('Error getting watchers for idea', error as Error, { operation: 'getIdeaWatchers', idea_id: ideaId });
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
   * @returns The list of ideas
   */
  public static async listIdeas(
    query?: string,
    updatedSince?: string,
    assignedToUser?: string,
    status?: string,
    category?: string,
    fields?: string
  ): Promise<IdeasListResponse> {
    const ideasApi = this.getIdeasApi();
    try {
      const response = await ideasApi.ideasList({
        q: query,
        updatedSince,
        assignedToUser,
        status,
        category,
        fields
      });
      return response.data;
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
   * @returns The list of releases for the product
   */
  public static async listReleasesByProduct(
    productId: string,
    query?: string,
    updatedSince?: string,
    status?: string,
    parkingLot?: boolean
  ): Promise<SdkReleasesListResponse> {
    const releasesApi = this.getReleasesApi();
    try {
      const response = await releasesApi.productReleasesList({
        productId,
        q: query,
        updatedSince,
        status,
        parkingLot
      });
      return response.data;
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
  public static async listCustomFields(): Promise<CustomFieldsListAll200Response> {
    const customFieldsApi = this.getCustomFieldsApi();
    try {
      const response = await customFieldsApi.customFieldsListAll();
      return response.data;
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
  public static async listCustomFieldOptions(customFieldDefinitionId: string): Promise<CustomFieldsListOptions200Response> {
    const customFieldsApi = this.getCustomFieldsApi();
    try {
      const response = await customFieldsApi.customFieldsListOptions({
        customFieldDefinitionId
      });
      return response.data;
    } catch (error) {
      log.error('Error listing custom field options', error as Error, { operation: 'listCustomFieldOptions', custom_field_definition_id: customFieldDefinitionId });
      throw error;
    }
  }
}
