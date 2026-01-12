/**
 * Mock implementation of IAhaService for testing
 */

import type { IAhaService } from './aha-service.interface.js';
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
  StrategicModelsListResponse,
  StrategicModel,
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

// Mock data generators
const generateMockFeature = (index: number): Feature => ({
  id: `FEAT-${index}`,
  reference_num: `FEAT-${index}`,
  name: `Test Feature ${index}`,
  description: {
    body: `Description for test feature ${index}`
  },
  workflow_status: {
    id: '1',
    name: 'Ready to develop'
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z'
} as Feature);

const generateMockProduct = (index: number) => ({
  id: `PROD-${index}`,
  reference_prefix: `PROD${index}`,
  name: `Test Product ${index}`,
  product_line: false,
  created_at: '2024-01-01T00:00:00Z'
});

const generateMockInitiative = (index: number) => ({
  initiative: {
    id: `INIT-${index}`,
    reference_num: `INIT-${index}`,
    name: `Test Initiative ${index}`,
    workflow_status: {
      id: '1',
      name: 'Active'
    },
    created_at: '2024-01-01T00:00:00Z'
  }
});

const generateMockGoal = (index: number) => ({
  goal: {
    id: `GOAL-${index}`,
    reference_num: `GOAL-${index}`,
    name: `Test Goal ${index}`,
    description: {
      body: `Description for test goal ${index}`
    },
    created_at: '2024-01-01T00:00:00Z'
  }
});

const generateMockRelease = (index: number) => ({
  release: {
    id: `REL-${index}`,
    reference_num: `REL-${index}`,
    name: `Test Release ${index}`,
    release_date: '2024-12-31',
    created_at: '2024-01-01T00:00:00Z'
  }
});

const generateMockStrategicModel = (index: number) => ({
  strategic_model: {
    id: `SM-${index}`,
    name: `Test Strategic Model ${index}`,
    type: 'vision',
    created_at: '2024-01-01T00:00:00Z'
  }
});

const generateMockIdeaOrganization = (index: number) => ({
  idea_organization: {
    id: `ORG-${index}`,
    name: `Test Organization ${index}`,
    email_domain: `testorg${index}.com`,
    created_at: '2024-01-01T00:00:00Z'
  }
});

const generateMockIdea = (index: number) => ({
  idea: {
    id: `IDEA-${index}`,
    reference_num: `IDEA-${index}`,
    name: `Test Idea ${index}`,
    description: {
      body: `Description for test idea ${index}`
    },
    workflow_status: {
      id: '1',
      name: 'New'
    },
    created_at: '2024-01-01T00:00:00Z'
  }
});

/**
 * Mock implementation of AhaService for testing
 */
export class MockAhaService implements IAhaService {
  initialize(): void {
    // Mock initialization - no-op
  }

  isInitialized(): boolean {
    return true;
  }

  async listFeatures(
    _query?: string,
    _updatedSince?: string,
    _tag?: string,
    _assignedToUser?: string,
    page?: number,
    perPage?: number
  ): Promise<FeaturesListResponse> {
    const count = Math.min(perPage || 20, 3);
    return {
      features: Array.from({ length: count }, (_, i) => generateMockFeature(i + 1)),
      pagination: {
        total_records: count,
        total_pages: 1,
        current_page: page || 1
      }
    } as FeaturesListResponse;
  }

  async getFeature(_featureId: string): Promise<Feature> {
    return generateMockFeature(1);
  }

  async updateFeature(_featureId: string, _featureData: any): Promise<Feature> {
    return generateMockFeature(1);
  }

  async deleteFeature(_featureId: string): Promise<void> {
    // Mock delete - no-op
  }

  async createFeature(_releaseId: string, _featureData: any): Promise<void> {
    // Mock create - no-op
  }

  async listProducts(
    _updatedSince?: string,
    page?: number,
    perPage?: number
  ): Promise<ProductsListResponse> {
    const count = Math.min(perPage || 20, 3);
    return {
      products: Array.from({ length: count }, (_, i) => generateMockProduct(i + 1)),
      pagination: {
        total_records: count,
        total_pages: 1,
        current_page: page || 1
      }
    } as ProductsListResponse;
  }

  async getProduct(_productId: string): Promise<Product> {
    return generateMockProduct(1) as Product;
  }

  async listInitiatives(
    _query?: string,
    _updatedSince?: string,
    _assignedToUser?: string,
    _onlyActive?: boolean,
    page?: number,
    perPage?: number
  ): Promise<InitiativesListResponse> {
    const count = Math.min(perPage || 20, 3);
    return {
      initiatives: Array.from({ length: count }, (_, i) => generateMockInitiative(i + 1)),
      pagination: {
        total_records: count,
        total_pages: 1,
        current_page: page || 1
      }
    } as InitiativesListResponse;
  }

  async getInitiative(_initiativeId: string): Promise<InitiativeResponse> {
    return generateMockInitiative(1) as InitiativeResponse;
  }

  async listGoals(
    _query?: string,
    _updatedSince?: string,
    _assignedToUser?: string,
    _status?: string,
    page?: number,
    perPage?: number
  ): Promise<SdkGoalsListResponse> {
    const count = Math.min(perPage || 20, 3);
    return {
      goals: Array.from({ length: count }, (_, i) => generateMockGoal(i + 1)),
      pagination: {
        total_records: count,
        total_pages: 1,
        current_page: page || 1
      }
    } as SdkGoalsListResponse;
  }

  async getGoal(_goalId: string): Promise<GoalGetResponse> {
    return generateMockGoal(1) as GoalGetResponse;
  }

  async listReleases(
    _query?: string,
    _updatedSince?: string,
    _assignedToUser?: string,
    _status?: string,
    _parkingLot?: boolean,
    page?: number,
    perPage?: number
  ): Promise<SdkReleasesListResponse> {
    const count = Math.min(perPage || 20, 3);
    return {
      releases: Array.from({ length: count }, (_, i) => generateMockRelease(i + 1)),
      pagination: {
        total_records: count,
        total_pages: 1,
        current_page: page || 1
      }
    } as SdkReleasesListResponse;
  }

  async getRelease(_releaseId: string): Promise<ReleaseGetResponse> {
    return generateMockRelease(1) as ReleaseGetResponse;
  }

  async listStrategicModels(
    _query?: string,
    _type?: string,
    _updatedSince?: string,
    page?: number,
    perPage?: number
  ): Promise<StrategicModelsListResponse> {
    const count = Math.min(perPage || 20, 3);
    return {
      strategic_models: Array.from({ length: count }, (_, i) => generateMockStrategicModel(i + 1)),
      pagination: {
        total_records: count,
        total_pages: 1,
        current_page: page || 1
      }
    } as StrategicModelsListResponse;
  }

  async getStrategicModel(_strategicModelId: string): Promise<StrategicModel> {
    return generateMockStrategicModel(1).strategic_model as StrategicModel;
  }

  async listIdeaOrganizations(
    _query?: string,
    _emailDomain?: string,
    page?: number,
    perPage?: number
  ): Promise<IdeaOrganizationsListResponse> {
    const count = Math.min(perPage || 20, 3);
    return {
      idea_organizations: Array.from({ length: count }, (_, i) => generateMockIdeaOrganization(i + 1)),
      pagination: {
        total_records: count,
        total_pages: 1,
        current_page: page || 1
      }
    } as IdeaOrganizationsListResponse;
  }

  async getIdeaOrganization(_ideaOrganizationId: string): Promise<IdeaOrganization> {
    return generateMockIdeaOrganization(1).idea_organization as IdeaOrganization;
  }

  async listIdeas(
    _query?: string,
    _updatedSince?: string,
    _assignedToUser?: string,
    _status?: string,
    _category?: string,
    _fields?: string,
    page?: number,
    perPage?: number
  ): Promise<IdeasListResponse> {
    const count = Math.min(perPage || 20, 3);
    return {
      ideas: Array.from({ length: count }, (_, i) => generateMockIdea(i + 1)),
      pagination: {
        total_records: count,
        total_pages: 1,
        current_page: page || 1
      }
    } as IdeasListResponse;
  }

  async getIdea(_ideaId: string): Promise<IdeaResponse> {
    return generateMockIdea(1) as IdeaResponse;
  }

  async listUsers(): Promise<{ users: User[] }> {
    return {
      users: [{
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      }] as User[]
    };
  }

  async getUser(_userId: string): Promise<User> {
    return {
      id: '1',
      name: 'Test User',
      email: 'test@example.com'
    } as User;
  }

  async getMe(): Promise<User> {
    return {
      id: '1',
      name: 'Test User',
      email: 'test@example.com'
    } as User;
  }

  async listEpics(_productId: string): Promise<EpicsList200Response> {
    return { epics: [] } as EpicsList200Response;
  }

  async getEpic(_epicId: string): Promise<Epic> {
    return { id: 'EPIC-1', name: 'Test Epic' } as Epic;
  }

  async listTodos(): Promise<TodosList200Response> {
    return { tasks: [] } as TodosList200Response;
  }

  async getTodo(_todoId: string): Promise<Todo> {
    return { id: 'TODO-1', description: 'Test Todo' } as Todo;
  }

  async listReleasePhases(): Promise<ReleasePhasesList200Response> {
    return { release_phases: [] } as ReleasePhasesList200Response;
  }

  async getReleasePhase(_releasePhaseId: string): Promise<SdkReleasePhase> {
    return { id: 'PHASE-1', name: 'Test Phase' } as SdkReleasePhase;
  }

  async createFeatureComment(_featureId: string, body: string): Promise<Comment> {
    return {
      id: '1',
      body,
      created_at: new Date().toISOString()
    } as Comment;
  }

  async getEpicComments(_epicId: string): Promise<CommentsGetEpic200Response> {
    return { comments: [] } as CommentsGetEpic200Response;
  }

  async getIdeaComments(_ideaId: string): Promise<CommentsGetEpic200Response> {
    return { comments: [] } as CommentsGetEpic200Response;
  }

  async getInitiativeComments(_initiativeId: string): Promise<CommentsGetEpic200Response> {
    return { comments: [] } as CommentsGetEpic200Response;
  }

  async getProductComments(_productId: string): Promise<CommentsGetEpic200Response> {
    return { comments: [] } as CommentsGetEpic200Response;
  }

  async getGoalComments(_goalId: string): Promise<CommentsGetEpic200Response> {
    return { comments: [] } as CommentsGetEpic200Response;
  }

  async getReleaseComments(_releaseId: string): Promise<CommentsGetEpic200Response> {
    return { comments: [] } as CommentsGetEpic200Response;
  }

  async getReleasePhaseComments(_releasePhaseId: string): Promise<CommentsGetEpic200Response> {
    return { comments: [] } as CommentsGetEpic200Response;
  }

  async getRequirementComments(_requirementId: string): Promise<CommentsGetEpic200Response> {
    return { comments: [] } as CommentsGetEpic200Response;
  }

  async getTodoComments(_todoId: string): Promise<CommentsGetEpic200Response> {
    return { comments: [] } as CommentsGetEpic200Response;
  }

  async listIdeasByProduct(_productId: string): Promise<IdeasListResponse> {
    return {
      ideas: Array.from({ length: 3 }, (_, i) => generateMockIdea(i + 1)),
      pagination: { total_records: 3, total_pages: 1, current_page: 1 }
    } as IdeasListResponse;
  }

  async listReleasesByProduct(_productId: string): Promise<SdkReleasesListResponse> {
    return {
      releases: Array.from({ length: 3 }, (_, i) => generateMockRelease(i + 1)),
      pagination: { total_records: 3, total_pages: 1, current_page: 1 }
    } as SdkReleasesListResponse;
  }

  async listCompetitors(_productId: string): Promise<CompetitorsListResponse> {
    return { competitors: [] } as CompetitorsListResponse;
  }

  async getGoalEpics(_goalId: string): Promise<GoalEpicsResponse> {
    return { epics: [] } as GoalEpicsResponse;
  }

  async getReleaseFeatures(_releaseId: string): Promise<ReleaseFeaturesResponse> {
    return { features: [] } as ReleaseFeaturesResponse;
  }

  async getReleaseEpics(_releaseId: string): Promise<EpicsList200Response> {
    return { epics: [] } as EpicsList200Response;
  }

  async getInitiativeEpics(_initiativeId: string): Promise<EpicsList200Response> {
    return { epics: [] } as EpicsList200Response;
  }

  async getAssignedRecords(): Promise<MeAssignedRecordsResponse> {
    return { records: [] } as MeAssignedRecordsResponse;
  }

  async getPendingTasks(): Promise<MePendingTasksResponse> {
    return { tasks: [] } as MePendingTasksResponse;
  }

  async getIdeaEndorsements(_ideaId: string): Promise<IdeasGetEndorsements200Response> {
    return { endorsements: [] } as IdeasGetEndorsements200Response;
  }

  async getIdeaVotes(_ideaId: string): Promise<IdeasGetVotes200Response> {
    return { votes: [] } as IdeasGetVotes200Response;
  }

  async getIdeaWatchers(_ideaId: string): Promise<IdeasGetWatchers200Response> {
    return { watchers: [] } as IdeasGetWatchers200Response;
  }

  async getRequirement(_requirementId: string): Promise<Requirement> {
    return { id: 'REQ-1', name: 'Test Requirement' } as Requirement;
  }

  async getCompetitor(_competitorId: string): Promise<Competitor> {
    return { id: 'COMP-1', name: 'Test Competitor' } as Competitor;
  }

  async listCustomFields(): Promise<CustomFieldsListAll200Response> {
    return { custom_fields: [] } as CustomFieldsListAll200Response;
  }

  async listCustomFieldOptions(_customFieldDefinitionId: string): Promise<CustomFieldsListOptions200Response> {
    return { options: [] } as CustomFieldsListOptions200Response;
  }
}
