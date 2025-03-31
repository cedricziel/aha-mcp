import * as aha from 'aha-js';
import { Configuration } from 'aha-js';
import axios from 'axios';

/**
 * Service for interacting with the Aha.io API
 */
export class AhaService {
  private static apiKey: string | null = process.env.AHA_TOKEN || null;
  private static subdomain: string | null = process.env.AHA_COMPANY || null;
  private static baseUrl: string | null = process.env.AHA_COMPANY ?
    `https://${process.env.AHA_COMPANY}.aha.io/api/v1` : null;

  /**
   * Initialize the Aha.io API client with authentication
   * This method is optional if AHA_TOKEN and AHA_COMPANY environment variables are set
   * @param apiKey The Aha.io API key
   * @param subdomain The Aha.io subdomain
   */
  public static initialize(apiKey: string, subdomain: string): void {
    this.apiKey = apiKey;
    this.subdomain = subdomain;
    this.baseUrl = `https://${subdomain}.aha.io/api/v1`;
  }

  /**
   * Get the Axios instance configured for Aha.io API
   * @returns Axios instance
   * @throws Error if the API client is not initialized and environment variables are not set
   */
  private static getAxiosInstance() {
    if (!this.apiKey || !this.baseUrl) {
      throw new Error('Aha API client not initialized. Either call initialize() or set AHA_TOKEN and AHA_COMPANY environment variables.');
    }

    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
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
    const axiosInstance = this.getAxiosInstance();

    try {
      const params: Record<string, string> = {};
      if (query) params.q = query;
      if (updatedSince) params.updated_since = updatedSince;
      if (tag) params.tag = tag;
      if (assignedToUser) params.assigned_to_user = assignedToUser;

      const response = await axiosInstance.get('/features', { params });
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
    const axiosInstance = this.getAxiosInstance();

    try {
      const response = await axiosInstance.get(`/features/${featureId}`);
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
    const axiosInstance = this.getAxiosInstance();

    try {
      const response = await axiosInstance.get('/users');
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
    const axiosInstance = this.getAxiosInstance();

    try {
      const response = await axiosInstance.get(`/products/${productId}/epics`);
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
    const axiosInstance = this.getAxiosInstance();

    try {
      const response = await axiosInstance.post(`/features/${featureId}/comments`, {
        comment: {
          body
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
    const axiosInstance = this.getAxiosInstance();

    try {
      const response = await axiosInstance.get(`/ideas/${ideaId}`);
      return response.data;
    } catch (error) {
      console.error(`Error getting idea ${ideaId}:`, error);
      throw error;
    }
  }
}
