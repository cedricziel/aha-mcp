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
  // Types
  Feature,
  FeaturesListResponse,
  Epic,
  User,
  IdeaResponse,
  InitiativeResponse,
  InitiativesListResponse,
  ProductsListResponse,
  EpicsEpicIdCommentsGet200Response,
  ProductsProductIdEpicsGet200Response,
  IdeasListResponse,
  Comment
} from '@cedricziel/aha-js';

import {
  Release,
  ReleasePhase,
  Goal,
  Product,
  Requirement,
  Todo,
  Competitor,
  ReleasesListResponse,
  ReleasesPhasesListResponse,
  GoalsListResponse,
  ReleaseFeaturesResponse,
  GoalEpicsResponse,
  RequirementsListResponse,
  TodosListResponse,
  CompetitorsListResponse
} from '../types/aha-types.js';

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

  private static apiKey: string | null = process.env.AHA_TOKEN || null;
  private static subdomain: string | null = process.env.AHA_COMPANY || null;

  /**
   * Initialize the Aha.io API client with authentication
   * This method is optional if AHA_TOKEN and AHA_COMPANY environment variables are set
   * @param apiKey The Aha.io API key
   * @param subdomain The Aha.io subdomain
   */
  public static initialize(apiKey?: string, subdomain?: string): void {
    if (apiKey) this.apiKey = apiKey;
    if (subdomain) this.subdomain = subdomain;

    this.initializeClient();
  }

  /**
   * Initialize the aha-js client with the current credentials
   * @private
   */
  private static initializeClient(): void {
    if (!this.apiKey || !this.subdomain) {
      throw new Error('Aha API client not initialized. Either call initialize() or set AHA_TOKEN and AHA_COMPANY environment variables.');
    }

    try {
      // Create a base path with the subdomain
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;

      // Initialize the configuration with the API key
      this.configuration = new Configuration({
        apiKey: this.apiKey,
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
    } catch (error) {
      console.error('Error initializing Aha.io client:', error);
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

    try {
      const params: Record<string, string> = {};
      if (query) params.q = query;
      if (updatedSince) params.updated_since = updatedSince;
      if (tag) params.tag = tag;
      if (assignedToUser) params.assigned_to_user = assignedToUser;

      // Use the appropriate method from the FeaturesApi
      const response = await featuresApi.featuresGet(params);
      return response.data;
    } catch (error) {
      console.error('Error listing features:', error);
      throw error;
    }
  }

  /**
   * Get a specific feature by ID
   * @param featureId The ID of the feature
   * @returns The feature details
   */
  public static async getFeature(featureId: string): Promise<Feature> {
    try {
      // Use direct API call since SDK method returns void
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/features/${featureId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get feature: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting feature ${featureId}:`, error);
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
      const response = await usersApi.usersGet();
      return { users: response.data };
    } catch (error) {
      console.error('Error listing users:', error);
      throw error;
    }
  }

  /**
   * Get a specific user by ID
   * @param userId The ID of the user
   * @returns The user details
   */
  public static async getUser(userId: string): Promise<User> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/users/${userId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get user: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * List epics in a product
   * @param productId The ID of the product
   * @returns A list of epics
   */
  public static async listEpics(productId: string): Promise<ProductsProductIdEpicsGet200Response> {
    const epicsApi = this.getEpicsApi();

    try {
      // Use the appropriate method from the EpicsApi with the correct parameter format
      const response = await epicsApi.productsProductIdEpicsGet({
        productId: productId
      });
      return response.data;
    } catch (error) {
      console.error(`Error listing epics for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific epic by ID
   * @param epicId The ID of the epic
   * @returns The epic details
   */
  public static async getEpic(epicId: string): Promise<Epic> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/epics/${epicId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get epic: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting epic ${epicId}:`, error);
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
    const featuresApi = this.getFeaturesApi();

    try {
      // Use the appropriate method from the FeaturesApi with the correct parameter format
      const response = await featuresApi.featuresFeatureIdCommentsPost({
        featureId: featureId,
        commentCreateRequest: {
          body: body
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error creating comment on feature ${featureId}:`, error);
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
      const response = await ideasApi.ideasIdGet({ id: ideaId });
      return response.data;
    } catch (error) {
      console.error(`Error getting idea ${ideaId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific product by ID
   * @param productId The ID of the product
   * @returns The product details
   */
  public static async getProduct(productId: string): Promise<Product> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/products/${productId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get product: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting product ${productId}:`, error);
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

      const response = await productsApi.productsGet(params);
      return response.data;
    } catch (error) {
      console.error('Error listing products:', error);
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
      const response = await initiativesApi.initiativesIdGet({ id: initiativeId });
      return response.data;
    } catch (error) {
      console.error(`Error getting initiative ${initiativeId}:`, error);
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

      const response = await initiativesApi.initiativesGet(params);
      return response.data;
    } catch (error) {
      console.error('Error listing initiatives:', error);
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
      const params: any = { productId };
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

      const response = await ideasApi.productsProductIdIdeasGet(params);
      return response.data;
    } catch (error) {
      console.error(`Error listing ideas for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a specific epic
   * @param epicId The ID of the epic
   * @returns A list of comments for the epic
   */
  public static async getEpicComments(epicId: string): Promise<EpicsEpicIdCommentsGet200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.epicsEpicIdCommentsGet({ epicId });
      return response.data;
    } catch (error) {
      console.error(`Error getting comments for epic ${epicId}:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a specific idea
   * @param ideaId The ID of the idea
   * @returns A list of comments for the idea
   */
  public static async getIdeaComments(ideaId: string): Promise<EpicsEpicIdCommentsGet200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.ideasIdeaIdCommentsGet({ ideaId });
      return response.data;
    } catch (error) {
      console.error(`Error getting comments for idea ${ideaId}:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a specific initiative
   * @param initiativeId The ID of the initiative
   * @returns A list of comments for the initiative
   */
  public static async getInitiativeComments(initiativeId: string): Promise<EpicsEpicIdCommentsGet200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.initiativesInitiativeIdCommentsGet({ initiativeId });
      return response.data;
    } catch (error) {
      console.error(`Error getting comments for initiative ${initiativeId}:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a specific product
   * @param productId The ID of the product
   * @returns A list of comments for the product
   */
  public static async getProductComments(productId: string): Promise<EpicsEpicIdCommentsGet200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.productsProductIdCommentsGet({ productId });
      return response.data;
    } catch (error) {
      console.error(`Error getting comments for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a specific goal
   * @param goalId The ID of the goal
   * @returns A list of comments for the goal
   */
  public static async getGoalComments(goalId: string): Promise<EpicsEpicIdCommentsGet200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.goalsGoalIdCommentsGet({ goalId });
      return response.data;
    } catch (error) {
      console.error(`Error getting comments for goal ${goalId}:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a specific release
   * @param releaseId The ID of the release
   * @returns A list of comments for the release
   */
  public static async getReleaseComments(releaseId: string): Promise<EpicsEpicIdCommentsGet200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.releasesReleaseIdCommentsGet({ releaseId });
      return response.data;
    } catch (error) {
      console.error(`Error getting comments for release ${releaseId}:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a specific release phase
   * @param releasePhaseId The ID of the release phase
   * @returns A list of comments for the release phase
   */
  public static async getReleasePhaseComments(releasePhaseId: string): Promise<EpicsEpicIdCommentsGet200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.releasePhasesReleasePhaseIdCommentsGet({ releasePhaseId });
      return response.data;
    } catch (error) {
      console.error(`Error getting comments for release phase ${releasePhaseId}:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a specific requirement
   * @param requirementId The ID of the requirement
   * @returns A list of comments for the requirement
   */
  public static async getRequirementComments(requirementId: string): Promise<EpicsEpicIdCommentsGet200Response> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.requirementsRequirementIdCommentsGet({ requirementId });
      return response.data;
    } catch (error) {
      console.error(`Error getting comments for requirement ${requirementId}:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a specific todo
   * @param todoId The ID of the todo
   * @returns A list of comments for the todo
   */
  public static async getTodoComments(todoId: string): Promise<EpicsEpicIdCommentsGet200Response> {
    const todosApi = this.getTodosApi();

    try {
      const response = await todosApi.todosTodoIdCommentsGet({ todoId });
      return response.data;
    } catch (error) {
      console.error(`Error getting comments for todo ${todoId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific goal by ID
   * @param goalId The ID of the goal
   * @returns The goal details
   */
  public static async getGoal(goalId: string): Promise<Goal> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/goals/${goalId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get goal: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting goal ${goalId}:`, error);
      throw error;
    }
  }

  /**
   * List goals from Aha.io
   * @returns A list of goals
   */
  public static async listGoals(): Promise<GoalsListResponse> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/goals`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list goals: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error listing goals:', error);
      throw error;
    }
  }

  /**
   * Get epics associated with a specific goal
   * @param goalId The ID of the goal
   * @returns A list of epics associated with the goal
   */
  public static async getGoalEpics(goalId: string): Promise<GoalEpicsResponse> {
    const goalsApi = this.getGoalsApi();

    try {
      const response = await goalsApi.goalsGoalIdEpicsGet({ goalId });
      return response.data;
    } catch (error) {
      console.error(`Error getting epics for goal ${goalId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific release by ID
   * @param releaseId The ID of the release
   * @returns The release details
   */
  public static async getRelease(releaseId: string): Promise<Release> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/releases/${releaseId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get release: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting release ${releaseId}:`, error);
      throw error;
    }
  }

  /**
   * List releases from Aha.io
   * @returns A list of releases
   */
  public static async listReleases(): Promise<ReleasesListResponse> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/releases`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list releases: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error listing releases:', error);
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
      console.error(`Error getting features for release ${releaseId}:`, error);
      throw error;
    }
  }

  /**
   * Get epics associated with a specific release
   * @param releaseId The ID of the release
   * @returns A list of epics associated with the release
   */
  public static async getReleaseEpics(releaseId: string): Promise<ProductsProductIdEpicsGet200Response> {
    const epicsApi = this.getEpicsApi();

    try {
      const response = await epicsApi.releasesReleaseIdEpicsGet({ releaseId });
      return response.data;
    } catch (error) {
      console.error(`Error getting epics for release ${releaseId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific release phase by ID
   * @param releasePhaseId The ID of the release phase
   * @returns The release phase details
   */
  public static async getReleasePhase(releasePhaseId: string): Promise<ReleasePhase> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/release_phases/${releasePhaseId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get release phase: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting release phase ${releasePhaseId}:`, error);
      throw error;
    }
  }

  /**
   * List release phases from Aha.io
   * @returns A list of release phases
   */
  public static async listReleasePhases(): Promise<ReleasesPhasesListResponse> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/release_phases`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list release phases: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error listing release phases:', error);
      throw error;
    }
  }

  /**
   * Get a specific requirement by ID
   * @param requirementId The ID of the requirement
   * @returns The requirement details
   */
  public static async getRequirement(requirementId: string): Promise<Requirement> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/requirements/${requirementId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get requirement: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting requirement ${requirementId}:`, error);
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
      const response = await competitorsApi.competitorsCompetitorIdGet({ competitorId });
      return response.data;
    } catch (error) {
      console.error(`Error getting competitor ${competitorId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific todo by ID
   * @param todoId The ID of the todo
   * @returns The todo details
   */
  public static async getTodo(todoId: string): Promise<Todo> {
    try {
      // Use direct API call since there's no specific method in the SDK
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/todos/${todoId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get todo: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting todo ${todoId}:`, error);
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
      const response = await competitorsApi.productsProductIdCompetitorsGet({ productId });
      return response.data;
    } catch (error) {
      console.error(`Error listing competitors for product ${productId}:`, error);
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
      console.error(`Error associating feature ${featureId} with epic ${epicId}:`, error);
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
      console.error(`Error moving feature ${featureId} to release ${releaseId}:`, error);
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
      console.error(`Error associating feature ${featureId} with goals ${goalIds.join(', ')}:`, error);
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
      console.error(`Error updating tags for feature ${featureId}:`, error);
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
      const response = await epicsApi.productsProductIdEpicsPost({
        productId: productId,
        epicCreateRequest: epicData
      });
      return response.data;
    } catch (error) {
      console.error(`Error creating epic in product ${productId}:`, error);
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
      const response = await epicsApi.releasesReleaseIdEpicsPost({
        releaseId: releaseId,
        epicCreateRequest: epicData
      });
      return response.data;
    } catch (error) {
      console.error(`Error creating epic in release ${releaseId}:`, error);
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
      const response = await initiativesApi.productsProductIdInitiativesPost({
        productId: productId,
        initiativeCreateRequest: initiativeData
      });
      return response.data;
    } catch (error) {
      console.error(`Error creating initiative in product ${productId}:`, error);
      throw error;
    }
  }
}
