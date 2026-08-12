/**
 * Interface for AhaService - allows for mock implementations in tests
 *
 * Every method speaks in the local domain types from `../types/aha-types.js`, never in
 * `@cedricziel/aha-js` types. The SDK is generated per-operation and renames every export
 * on each regeneration (`Feature` -> `FeaturesGetResponseFeaturesInner`, etc.); leaking
 * those through here would re-break every call site the next time aha-js regenerates.
 * `aha-service.ts` is the only file allowed to import from `@cedricziel/aha-js` - it is
 * responsible for mapping the SDK's response shapes onto the types below.
 */

import type {
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
  GoalGetResponse,
  GoalsListResponse,
  GoalEpicsResponse,
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
  CustomFieldOptionsResponse
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
  createFeature(releaseId: string, featureData: any): Promise<unknown>;

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
  ): Promise<GoalsListResponse>;
  getGoal(goalId: string): Promise<GoalGetResponse>;

  // Releases
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
  ): Promise<IdeasListResponse>;
  getIdea(ideaId: string): Promise<IdeaResponse>;

  // Users
  listUsers(): Promise<{ users: User[] }>;
  getUser(userId: string): Promise<User>;
  getMe(): Promise<User>;

  // Epics
  listEpics(productId: string): Promise<EpicsListResponse>;
  getEpic(epicId: string): Promise<Epic>;

  // Todos
  listTodos(): Promise<TodosListResponse>;
  getTodo(todoId: string): Promise<Todo>;

  // Release Phases
  listReleasePhases(): Promise<ReleasePhasesListResponse>;
  getReleasePhase(releasePhaseId: string): Promise<ReleasePhase>;

  // Comments
  createFeatureComment(featureId: string, body: string): Promise<Comment>;
  getEpicComments(epicId: string): Promise<CommentsListResponse>;
  getIdeaComments(ideaId: string): Promise<CommentsListResponse>;
  getInitiativeComments(initiativeId: string): Promise<CommentsListResponse>;
  getProductComments(productId: string): Promise<CommentsListResponse>;
  getGoalComments(goalId: string): Promise<CommentsListResponse>;
  getReleaseComments(releaseId: string): Promise<CommentsListResponse>;
  getReleasePhaseComments(releasePhaseId: string): Promise<CommentsListResponse>;
  getRequirementComments(requirementId: string): Promise<CommentsListResponse>;
  getTodoComments(todoId: string): Promise<CommentsListResponse>;

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
  ): Promise<ReleasesListResponse>;
  listCompetitors(productId: string): Promise<CompetitorsListResponse>;

  // Relationships
  getGoalEpics(goalId: string): Promise<GoalEpicsResponse>;
  getReleaseFeatures(releaseId: string): Promise<ReleaseFeaturesResponse>;
  getReleaseEpics(releaseId: string): Promise<EpicsListResponse>;
  getInitiativeEpics(initiativeId: string): Promise<EpicsListResponse>;

  // Me/Current User
  getAssignedRecords(): Promise<MeAssignedRecordsResponse>;
  getPendingTasks(): Promise<MePendingTasksResponse>;

  // Idea Endorsements/Votes
  getIdeaEndorsements(
    ideaId: string,
    proxy?: boolean,
    page?: number,
    perPage?: number
  ): Promise<IdeaEndorsementsResponse>;
  getIdeaVotes(
    ideaId: string,
    page?: number,
    perPage?: number
  ): Promise<IdeaVotesResponse>;

  // Requirements
  getRequirement(requirementId: string): Promise<Requirement>;

  // Competitors
  getCompetitor(competitorId: string): Promise<Competitor>;

  // Custom Fields
  listCustomFields(): Promise<CustomFieldDefinitionsResponse>;
  listCustomFieldOptions(customFieldDefinitionId: string): Promise<CustomFieldOptionsResponse>;
}
