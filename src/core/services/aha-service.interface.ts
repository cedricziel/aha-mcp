/**
 * Interface for AhaService - allows for mock implementations in tests
 */

import type {
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

import type {
  Product,
  Requirement,
  Todo,
  ReleaseFeaturesResponse,
  GoalEpicsResponse,
  CompetitorsListResponse
} from '../types/aha-types.js';

export interface IAhaService {
  // Initialization
  initialize(
    configOrApiKey?: string | {
      apiKey?: string;
      accessToken?: string;
      subdomain?: string;
    },
    subdomain?: string
  ): void;
  isInitialized(): boolean;

  // Features
  listFeatures(
    query?: string,
    updatedSince?: string,
    tag?: string,
    assignedToUser?: string,
    page?: number,
    perPage?: number
  ): Promise<FeaturesListResponse>;
  getFeature(featureId: string): Promise<Feature>;
  updateFeature(featureId: string, featureData: any): Promise<Feature>;
  deleteFeature(featureId: string): Promise<void>;
  createFeature(releaseId: string, featureData: any): Promise<void>;

  // Products
  listProducts(
    updatedSince?: string,
    page?: number,
    perPage?: number
  ): Promise<ProductsListResponse>;
  getProduct(productId: string): Promise<Product>;

  // Initiatives
  listInitiatives(
    query?: string,
    updatedSince?: string,
    assignedToUser?: string,
    onlyActive?: boolean,
    page?: number,
    perPage?: number
  ): Promise<InitiativesListResponse>;
  getInitiative(initiativeId: string): Promise<InitiativeResponse>;

  // Goals
  listGoals(
    query?: string,
    updatedSince?: string,
    assignedToUser?: string,
    status?: string,
    page?: number,
    perPage?: number
  ): Promise<SdkGoalsListResponse>;
  getGoal(goalId: string): Promise<GoalGetResponse>;

  // Releases
  listReleases(
    query?: string,
    updatedSince?: string,
    assignedToUser?: string,
    status?: string,
    parkingLot?: boolean,
    page?: number,
    perPage?: number
  ): Promise<SdkReleasesListResponse>;
  getRelease(releaseId: string): Promise<ReleaseGetResponse>;

  // Strategic Models
  listStrategicModels(
    query?: string,
    type?: string,
    updatedSince?: string,
    page?: number,
    perPage?: number
  ): Promise<StrategicModelsListResponse>;
  getStrategicModel(strategicModelId: string): Promise<StrategicModel>;

  // Idea Organizations
  listIdeaOrganizations(
    query?: string,
    emailDomain?: string,
    page?: number,
    perPage?: number
  ): Promise<IdeaOrganizationsListResponse>;
  getIdeaOrganization(ideaOrganizationId: string): Promise<IdeaOrganization>;

  // Ideas
  listIdeas(
    query?: string,
    updatedSince?: string,
    assignedToUser?: string,
    status?: string,
    category?: string,
    fields?: string,
    page?: number,
    perPage?: number
  ): Promise<IdeasListResponse>;
  getIdea(ideaId: string): Promise<IdeaResponse>;

  // Users
  listUsers(): Promise<{ users: User[] }>;
  getUser(userId: string): Promise<User>;
  getMe(): Promise<User>;

  // Epics
  listEpics(productId: string): Promise<EpicsList200Response>;
  getEpic(epicId: string): Promise<Epic>;

  // Todos
  listTodos(): Promise<TodosList200Response>;
  getTodo(todoId: string): Promise<Todo>;

  // Release Phases
  listReleasePhases(): Promise<ReleasePhasesList200Response>;
  getReleasePhase(releasePhaseId: string): Promise<SdkReleasePhase>;

  // Comments
  createFeatureComment(featureId: string, body: string): Promise<Comment>;
  getEpicComments(epicId: string): Promise<CommentsGetEpic200Response>;
  getIdeaComments(ideaId: string): Promise<CommentsGetEpic200Response>;
  getInitiativeComments(initiativeId: string): Promise<CommentsGetEpic200Response>;
  getProductComments(productId: string): Promise<CommentsGetEpic200Response>;
  getGoalComments(goalId: string): Promise<CommentsGetEpic200Response>;
  getReleaseComments(releaseId: string): Promise<CommentsGetEpic200Response>;
  getReleasePhaseComments(releasePhaseId: string): Promise<CommentsGetEpic200Response>;
  getRequirementComments(requirementId: string): Promise<CommentsGetEpic200Response>;
  getTodoComments(todoId: string): Promise<CommentsGetEpic200Response>;

  // Additional list methods
  listIdeasByProduct(
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
  ): Promise<IdeasListResponse>;
  listReleasesByProduct(
    productId: string,
    query?: string,
    updatedSince?: string,
    status?: string,
    parkingLot?: boolean,
    page?: number,
    perPage?: number
  ): Promise<SdkReleasesListResponse>;
  listCompetitors(productId: string): Promise<CompetitorsListResponse>;

  // Relationships
  getGoalEpics(goalId: string): Promise<GoalEpicsResponse>;
  getReleaseFeatures(releaseId: string): Promise<ReleaseFeaturesResponse>;
  getReleaseEpics(releaseId: string): Promise<EpicsList200Response>;
  getInitiativeEpics(initiativeId: string): Promise<EpicsList200Response>;

  // Me/Current User
  getAssignedRecords(): Promise<MeAssignedRecordsResponse>;
  getPendingTasks(): Promise<MePendingTasksResponse>;

  // Idea Endorsements/Votes
  getIdeaEndorsements(ideaId: string): Promise<IdeasGetEndorsements200Response>;
  getIdeaVotes(ideaId: string): Promise<IdeasGetVotes200Response>;
  getIdeaWatchers(ideaId: string): Promise<IdeasGetWatchers200Response>;

  // Requirements
  getRequirement(requirementId: string): Promise<Requirement>;

  // Competitors
  getCompetitor(competitorId: string): Promise<Competitor>;

  // Custom Fields
  listCustomFields(): Promise<CustomFieldsListAll200Response>;
  listCustomFieldOptions(customFieldDefinitionId: string): Promise<CustomFieldsListOptions200Response>;
}
