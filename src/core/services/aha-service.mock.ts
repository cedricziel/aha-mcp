/**
 * Mock implementation of IAhaService for testing
 */

import type { IAhaService } from './aha-service.interface.js';
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
  CustomFieldOptionsResponse
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

/**
 * A key result carries no `url` of its own - measured against a live account - so the mock
 * does not invent one.
 */
const generateMockKeyResult = (index: number, goalRef = 'GOAL-1') => ({
  id: `KR-${index}`,
  reference_num: `${goalRef}-KR-${index}`,
  name: `Test Key Result ${index}`,
  position: index,
  progress: 0,
  target_metric: '100',
  starting_metric: '0',
  current_metric: '10',
  workflow_status: {
    id: '1',
    name: 'Not started'
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z'
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

  async createFeature(_releaseId: string, featureData: any): Promise<unknown> {
    // Shaped as `{ feature: { ... } }`, which is what Aha returns and what the create path
    // unwraps. Spreading `featureData` at the root instead put its own `feature` key there,
    // so `unwrapRecord` descended into it and the identifiers were lost - leaving
    // structuredContent without an id and recordLinks with nothing to link to.
    const inner = featureData?.feature ?? featureData ?? {};
    return { feature: { id: 'MOCK-FEATURE-1', reference_num: 'MOCK-1', ...inner } };
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
      // The generator wraps under `initiative` because `getInitiative` below needs that shape
      // to match `InitiativeResponse` - a list entry does not, and `InitiativesListResponse`
      // types `initiatives` as flat `Initiative[]`, so it is unwrapped here.
      initiatives: Array.from({ length: count }, (_, i) => generateMockInitiative(i + 1).initiative),
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
  ): Promise<GoalsListResponse> {
    const count = Math.min(perPage || 20, 3);
    return {
      // Same reasoning as listInitiatives above: `GoalsListResponse.goals` is flat `Goal[]`,
      // the `goal` wrapper is only correct for the single-record `getGoal` response.
      goals: Array.from({ length: count }, (_, i) => generateMockGoal(i + 1).goal),
      pagination: {
        total_records: count,
        total_pages: 1,
        current_page: page || 1
      }
    } as GoalsListResponse;
  }

  async getGoal(_goalId: string): Promise<GoalGetResponse> {
    return generateMockGoal(1) as GoalGetResponse;
  }

  async createGoal(_productId: string, _goalData: any): Promise<GoalGetResponse> {
    return generateMockGoal(1) as GoalGetResponse;
  }

  async updateGoal(_goalId: string, _goalData: any, _productId?: string): Promise<GoalGetResponse> {
    return generateMockGoal(1) as GoalGetResponse;
  }

  async deleteGoal(_productId: string, _goalId: string): Promise<void> {
    return;
  }

  async listKeyResults(
    _goalId: string,
    page?: number,
    perPage?: number
  ): Promise<KeyResultsListResponse> {
    const count = Math.min(perPage || 20, 3);
    return {
      key_results: Array.from({ length: count }, (_, i) => generateMockKeyResult(i + 1)),
      pagination: {
        total_records: count,
        total_pages: 1,
        current_page: page || 1
      }
    } as KeyResultsListResponse;
  }

  async getKeyResult(_keyResultId: string): Promise<KeyResultResponse> {
    return { key_result: generateMockKeyResult(1) } as KeyResultResponse;
  }

  async createKeyResult(_goalId: string, _keyResultData: any): Promise<KeyResultResponse> {
    return { key_result: generateMockKeyResult(1) } as KeyResultResponse;
  }

  async updateKeyResult(_keyResultId: string, _keyResultData: any): Promise<KeyResultResponse> {
    return { key_result: generateMockKeyResult(1) } as KeyResultResponse;
  }

  async deleteKeyResult(_keyResultId: string): Promise<void> {
    return;
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
      // Unwrapped for the same reason as listInitiatives/listGoals: `strategic_models` is a
      // flat `StrategicModel[]`, matching what `getStrategicModel` below already unwraps to.
      strategic_models: Array.from({ length: count }, (_, i) => generateMockStrategicModel(i + 1).strategic_model),
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
      // Unwrapped for the same reason as the other list methods above: `idea_organizations`
      // is a flat `IdeaOrganization[]`, matching what `getIdeaOrganization` unwraps to.
      idea_organizations: Array.from({ length: count }, (_, i) => generateMockIdeaOrganization(i + 1).idea_organization),
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
      // Unwrapped for the same reason as the other list methods above: `IdeasListResponse.ideas`
      // is flat `Idea[]`, the `idea` wrapper is only correct for the single-record `getIdea`.
      ideas: Array.from({ length: count }, (_, i) => generateMockIdea(i + 1).idea),
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

  async listEpics(_productId: string): Promise<EpicsListResponse> {
    return { epics: [] } as EpicsListResponse;
  }

  async getEpic(_epicId: string): Promise<Epic> {
    return { id: 'EPIC-1', name: 'Test Epic' } as Epic;
  }

  async listTodos(): Promise<TodosListResponse> {
    return { todos: [] } as TodosListResponse;
  }

  async getTodo(_todoId: string): Promise<Todo> {
    return { id: 'TODO-1', description: 'Test Todo' } as Todo;
  }

  async listReleasePhases(): Promise<ReleasePhasesListResponse> {
    return { release_phases: [] } as ReleasePhasesListResponse;
  }

  async getReleasePhase(_releasePhaseId: string): Promise<ReleasePhase> {
    return { id: 'PHASE-1', name: 'Test Phase' } as ReleasePhase;
  }

  async createFeatureComment(_featureId: string, body: string): Promise<Comment> {
    return {
      id: '1',
      body,
      created_at: new Date().toISOString()
    } as Comment;
  }

  async getFeatureComments(_featureId: string): Promise<CommentsListResponse> {
    return { comments: [] } as CommentsListResponse;
  }

  async createEpicComment(_epicId: string, body: string): Promise<Comment> {
    return { id: '1', body, created_at: new Date().toISOString() } as Comment;
  }

  async createIdeaComment(_ideaId: string, body: string): Promise<Comment> {
    return { id: '1', body, created_at: new Date().toISOString() } as Comment;
  }

  async createInitiativeComment(_initiativeId: string, body: string): Promise<Comment> {
    return { id: '1', body, created_at: new Date().toISOString() } as Comment;
  }

  async createGoalComment(_goalId: string, body: string): Promise<Comment> {
    return { id: '1', body, created_at: new Date().toISOString() } as Comment;
  }

  async createReleaseComment(_releaseId: string, body: string): Promise<Comment> {
    return { id: '1', body, created_at: new Date().toISOString() } as Comment;
  }

  async createReleasePhaseComment(_releasePhaseId: string, body: string): Promise<Comment> {
    return { id: '1', body, created_at: new Date().toISOString() } as Comment;
  }

  async createRequirementComment(_requirementId: string, body: string): Promise<Comment> {
    return { id: '1', body, created_at: new Date().toISOString() } as Comment;
  }

  async createTodoComment(_todoId: string, body: string): Promise<Comment> {
    return { id: '1', body, created_at: new Date().toISOString() } as Comment;
  }

  /**
   * Portal comments are a separate endpoint from `getIdeaComments`, so the mock keeps them
   * separate too - a mock that returned the same list for both would hide the very split
   * these methods exist to expose.
   */
  async getIdeaPortalComments(ideaId: string): Promise<IdeaCommentsListResponse> {
    return {
      idea_comments: [
        {
          id: 'IC-1',
          idea_id: ideaId,
          body: '<p>Why was this rejected?</p>',
          visibility: 'Visible to all ideas portal users',
          idea_commenter_portal_user: { email: 'customer@example.com' }
        }
      ]
    } as IdeaCommentsListResponse;
  }

  async createIdeaPortalComment(
    ideaId: string,
    body: string,
    visibility: IdeaCommentVisibility
  ): Promise<IdeaComment> {
    return {
      id: 'IC-2',
      idea_id: ideaId,
      body,
      // Echoed back as given rather than as Aha's human-readable phrase; the mock is not the
      // place to invent a mapping between the two vocabularies.
      visibility,
      created_at: new Date().toISOString()
    } as IdeaComment;
  }

  async getEpicComments(_epicId: string): Promise<CommentsListResponse> {
    return { comments: [] } as CommentsListResponse;
  }

  async getIdeaComments(_ideaId: string): Promise<CommentsListResponse> {
    return { comments: [] } as CommentsListResponse;
  }

  async getInitiativeComments(_initiativeId: string): Promise<CommentsListResponse> {
    return { comments: [] } as CommentsListResponse;
  }

  async getProductComments(_productId: string): Promise<CommentsListResponse> {
    return { comments: [] } as CommentsListResponse;
  }

  async getGoalComments(_goalId: string): Promise<CommentsListResponse> {
    return { comments: [] } as CommentsListResponse;
  }

  async getReleaseComments(_releaseId: string): Promise<CommentsListResponse> {
    return { comments: [] } as CommentsListResponse;
  }

  async getReleasePhaseComments(_releasePhaseId: string): Promise<CommentsListResponse> {
    return { comments: [] } as CommentsListResponse;
  }

  async getRequirementComments(_requirementId: string): Promise<CommentsListResponse> {
    return { comments: [] } as CommentsListResponse;
  }

  async getTodoComments(_todoId: string): Promise<CommentsListResponse> {
    return { comments: [] } as CommentsListResponse;
  }

  async listIdeasByProduct(_productId: string): Promise<IdeasListResponse> {
    return {
      // Unwrapped for the same reason as listIdeas above.
      ideas: Array.from({ length: 3 }, (_, i) => generateMockIdea(i + 1).idea),
      pagination: { total_records: 3, total_pages: 1, current_page: 1 }
    } as IdeasListResponse;
  }

  async listReleasesByProduct(_productId: string): Promise<ReleasesListResponse> {
    return {
      // `ReleasesListResponse.releases` is flat `Release[]`; the `release` wrapper is only
      // correct for the single-record `getRelease` response above.
      releases: Array.from({ length: 3 }, (_, i) => generateMockRelease(i + 1).release),
      pagination: { total_records: 3, total_pages: 1, current_page: 1 }
    } as ReleasesListResponse;
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

  async getReleaseEpics(_releaseId: string): Promise<EpicsListResponse> {
    return { epics: [] } as EpicsListResponse;
  }

  async getInitiativeEpics(_initiativeId: string): Promise<EpicsListResponse> {
    return { epics: [] } as EpicsListResponse;
  }

  async getAssignedRecords(): Promise<MeAssignedRecordsResponse> {
    return { records: [] } as MeAssignedRecordsResponse;
  }

  async getPendingTasks(): Promise<MePendingTasksResponse> {
    return { tasks: [] } as MePendingTasksResponse;
  }

  async getIdeaEndorsements(_ideaId: string): Promise<IdeaEndorsementsResponse> {
    return { idea_endorsements: [] } as IdeaEndorsementsResponse;
  }

  async getIdeaVotes(_ideaId: string): Promise<IdeaVotesResponse> {
    return { idea_endorsements: [] } as IdeaVotesResponse;
  }

  async getRequirement(_requirementId: string): Promise<Requirement> {
    return { id: 'REQ-1', name: 'Test Requirement' } as Requirement;
  }

  async getCompetitor(_competitorId: string): Promise<Competitor> {
    return { id: 'COMP-1', name: 'Test Competitor' } as Competitor;
  }

  async listCustomFields(): Promise<CustomFieldDefinitionsResponse> {
    return { custom_field_definitions: [] } as CustomFieldDefinitionsResponse;
  }

  async listCustomFieldOptions(_customFieldDefinitionId: string): Promise<CustomFieldOptionsResponse> {
    return { options: [] } as CustomFieldOptionsResponse;
  }
}
