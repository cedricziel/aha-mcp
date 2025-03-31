import {
  Configuration,
  FeaturesApi,
  IdeasApi,
  UsersApi,
  EpicsApi
} from 'aha-js';

/**
 * Service for interacting with the Aha.io API
 */
export class AhaService {
  private static configuration: Configuration | null = null;
  private static featuresApi: FeaturesApi | null = null;
  private static ideasApi: IdeasApi | null = null;
  private static usersApi: UsersApi | null = null;
  private static epicsApi: EpicsApi | null = null;

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
    const featuresApi = this.getFeaturesApi();

    try {
      // Since there's no direct method to get a feature by ID in the API,
      // we'll use a workaround by making a direct request
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
    try {
      // Since there's no direct method to get an idea by ID in the API,
      // we'll use a workaround by making a direct request
      const basePath = `https://${this.subdomain}.aha.io/api/v1`;
      const url = `${basePath}/ideas/${ideaId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get idea: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting idea ${ideaId}:`, error);
      throw error;
    }
  }
}
