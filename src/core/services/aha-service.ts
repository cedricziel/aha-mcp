import {
  Configuration,
  FeaturesApi,
  IdeasApi,
  UsersApi,
  EpicsApi,
  DefaultApi,
  ProductsApi,
  InitiativesApi,
  CommentsApi,
  GoalsApi
} from '@cedricziel/aha-js';

/**
 * Service for interacting with the Aha.io API
 */
export class AhaService {
  private static configuration: Configuration | null = null;
  private static featuresApi: FeaturesApi | null = null;
  private static ideasApi: IdeasApi | null = null;
  private static usersApi: UsersApi | null = null;
  private static epicsApi: EpicsApi | null = null;
  private static defaultApi: DefaultApi | null = null;
  private static productsApi: ProductsApi | null = null;
  private static initiativesApi: InitiativesApi | null = null;
  private static commentsApi: CommentsApi | null = null;
  private static goalsApi: GoalsApi | null = null;

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
      this.defaultApi = new DefaultApi(this.configuration);
      this.productsApi = new ProductsApi(this.configuration);
      this.initiativesApi = new InitiativesApi(this.configuration);
      this.commentsApi = new CommentsApi(this.configuration);
      this.goalsApi = new GoalsApi(this.configuration);
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
  ): Promise<any> {
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
  public static async getFeature(featureId: string): Promise<any> {
    const defaultApi = this.getDefaultApi();

    try {
      const response = await defaultApi.featuresIdGet({ id: featureId });
      return response.data;
    } catch (error) {
      console.error(`Error getting feature ${featureId}:`, error);
      throw error;
    }
  }

  /**
   * List users from Aha.io
   * @returns A list of users
   */
  public static async listUsers(): Promise<any> {
    const usersApi = this.getUsersApi();

    try {
      // Use the appropriate method from the UsersApi
      const response = await usersApi.usersGet();
      return response.data;
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
  public static async getUser(userId: string): Promise<any> {
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
  public static async listEpics(productId: string): Promise<any> {
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
  public static async getEpic(epicId: string): Promise<any> {
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
  public static async createFeatureComment(featureId: string, body: string): Promise<any> {
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
  public static async getIdea(ideaId: string): Promise<any> {
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
  public static async getProduct(productId: string): Promise<any> {
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
   * @returns A list of products
   */
  public static async listProducts(): Promise<any> {
    const productsApi = this.getProductsApi();

    try {
      const response = await productsApi.productsGet();
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
  public static async getInitiative(initiativeId: string): Promise<any> {
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
   * @returns A list of initiatives
   */
  public static async listInitiatives(): Promise<any> {
    const initiativesApi = this.getInitiativesApi();

    try {
      const response = await initiativesApi.initiativesGet();
      return response.data;
    } catch (error) {
      console.error('Error listing initiatives:', error);
      throw error;
    }
  }

  /**
   * List ideas for a specific product
   * @param productId The ID of the product
   * @returns A list of ideas for the product
   */
  public static async listIdeasByProduct(productId: string): Promise<any> {
    const ideasApi = this.getIdeasApi();

    try {
      const response = await ideasApi.productsProductIdIdeasGet({ productId });
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
  public static async getEpicComments(epicId: string): Promise<any> {
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
  public static async getIdeaComments(ideaId: string): Promise<any> {
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
  public static async getInitiativeComments(initiativeId: string): Promise<any> {
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
  public static async getProductComments(productId: string): Promise<any> {
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
  public static async getGoalComments(goalId: string): Promise<any> {
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
  public static async getReleaseComments(releaseId: string): Promise<any> {
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
  public static async getReleasePhaseComments(releasePhaseId: string): Promise<any> {
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
  public static async getRequirementComments(requirementId: string): Promise<any> {
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
  public static async getTodoComments(todoId: string): Promise<any> {
    const commentsApi = this.getCommentsApi();

    try {
      const response = await commentsApi.todosTodoIdCommentsGet({ todoId });
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
  public static async getGoal(goalId: string): Promise<any> {
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
  public static async listGoals(): Promise<any> {
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
  public static async getGoalEpics(goalId: string): Promise<any> {
    const goalsApi = this.getGoalsApi();

    try {
      const response = await goalsApi.goalsGoalIdEpicsGet({ goalId });
      return response.data;
    } catch (error) {
      console.error(`Error getting epics for goal ${goalId}:`, error);
      throw error;
    }
  }
}
