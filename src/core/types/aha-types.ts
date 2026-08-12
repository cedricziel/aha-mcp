/**
 * Domain types for Aha.io API responses.
 *
 * These are hand-maintained rather than imported from `@cedricziel/aha-js`. The SDK is
 * generated per-operation (`FeaturesGetResponseFeaturesInner`,
 * `EpicsPutResponseEpicGoalsInner`, ...) and those names change shape on every
 * regeneration, which used to leak straight through `AhaService`'s public signatures and
 * re-break the whole codebase. `IAhaService` speaks only in the types below instead, so a
 * future SDK bump only has to satisfy this file rather than every call site.
 *
 * Field lists follow what Aha actually returns (cross-checked against the generated model
 * files in `node_modules/@cedricziel/aha-js/dist/model/`), typed permissively: every field
 * is optional and every record carries an index signature, so a field Aha adds later - or a
 * field the generator's fixture-based spec mis-describes - still flows through rather than
 * being typed away. `structuredContent` in the MCP layer is validated with `z.looseObject`,
 * so extra keys are expected.
 *
 * Known generator quirk (not modeled around, just noted): several "get one record by id"
 * operations in aha-js 2.0.0 are typed as returning the *list* response for that resource
 * (e.g. `usersByIdGet`, `epicsByIdGet`, `goalsByIdGet` all return the same response type as
 * their `xByIdGet` siblings return for `xGet`). The real endpoint returns a single record
 * (Aha's actual documented API, and the shape the old hand-written spec assumed). Treat the
 * generated single-get response types as unreliable and prefer the wrapped/flat domain
 * shapes below, which reflect what `AhaService` has always actually unwrapped.
 */

/**
 * Pagination block returned by every Aha list endpoint.
 */
export interface Pagination {
  total_records?: number;
  total_pages?: number;
  current_page?: number;
  [key: string]: unknown;
}

/**
 * Aha's rich-text description wrapper, e.g. `{ id, body }`.
 */
export interface RichText {
  id?: string;
  body?: string;
  [key: string]: unknown;
}

/**
 * Workflow status attached to features, epics, ideas, initiatives, releases, requirements...
 */
export interface WorkflowStatus {
  id?: string;
  name?: string;
  color?: string;
  complete?: boolean;
  position?: number;
  [key: string]: unknown;
}

/**
 * A custom field value as attached to a record (`feature.custom_fields`, etc.)
 */
export interface CustomField {
  id?: string;
  key?: string;
  name?: string;
  type?: string;
  value?: unknown;
  [key: string]: unknown;
}

/**
 * A custom field *definition*, as returned by the account-wide custom fields endpoints.
 */
export interface CustomFieldDefinition {
  id?: string;
  key?: string;
  name?: string;
  type?: string;
  options?: CustomFieldOption[];
  [key: string]: unknown;
}

export interface CustomFieldDefinitionsResponse {
  custom_field_definitions?: CustomFieldDefinition[];
  [key: string]: unknown;
}

export interface CustomFieldOption {
  text?: string;
  value?: string;
  meta?: unknown;
  [key: string]: unknown;
}

export interface CustomFieldOptionsResponse {
  options?: CustomFieldOption[];
  [key: string]: unknown;
}

/**
 * Minimal reference to another record, as embedded in relations like `feature.release`,
 * `epic.initiative`, `goal.project`, etc. Aha embeds varying levels of detail here
 * depending on endpoint, so this is intentionally loose.
 */
export interface RecordRef {
  id?: string;
  name?: string;
  reference_num?: string;
  [key: string]: unknown;
}

/**
 * User entity. `GET /users` and `GET /users/{id}` both return this shape in practice
 * (id, name, email, ...); see the generator-quirk note above for why the 2.0.0 SDK types
 * disagree.
 */
export interface User {
  id?: string;
  name?: string;
  email?: string;
  username?: string;
  initials?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface UsersListResponse {
  users?: User[];
  pagination?: Pagination;
}

/**
 * Feature entity.
 */
export interface Feature {
  id?: string;
  name?: string;
  reference_num?: string;
  initiative_reference_num?: string;
  release_reference_num?: string;
  epic_reference_num?: string;
  position?: number;
  score?: number;
  created_at?: string;
  updated_at?: string;
  start_date?: string;
  due_date?: string;
  product_id?: string;
  progress?: number | null;
  progress_source?: string;
  created_by_user?: User;
  workflow_status?: WorkflowStatus;
  description?: RichText;
  url?: string;
  resource?: string;
  release?: RecordRef;
  master_feature?: RecordRef;
  epic?: RecordRef;
  assigned_to_user?: User;
  requirements?: Requirement[];
  initiative?: RecordRef;
  goals?: RecordRef[];
  key_results?: unknown[];
  comments_count?: number;
  score_facts?: unknown[];
  tags?: string[];
  custom_fields?: CustomField[];
  feature_links?: unknown[];
  [key: string]: unknown;
}

export interface FeaturesListResponse {
  features?: Feature[];
  pagination?: Pagination;
}

/**
 * Epic entity.
 */
export interface Epic {
  id?: string;
  name?: string;
  reference_num?: string;
  initiative_reference_num?: string;
  position?: number;
  score?: number;
  created_at?: string;
  updated_at?: string;
  start_date?: string;
  due_date?: string;
  product_id?: string;
  progress?: number | null;
  progress_source?: string;
  created_by_user?: User;
  workflow_status?: WorkflowStatus;
  description?: RichText;
  url?: string;
  resource?: string;
  release?: RecordRef;
  assigned_to_user?: User;
  features?: RecordRef[];
  initiative?: RecordRef;
  goals?: RecordRef[];
  comments_count?: number;
  tags?: string[];
  custom_fields?: CustomField[];
  [key: string]: unknown;
}

export interface EpicsListResponse {
  epics?: Epic[];
  pagination?: Pagination;
}

/**
 * Idea entity.
 */
export interface Idea {
  id?: string;
  name?: string;
  reference_num?: string;
  score?: number;
  created_at?: string;
  updated_at?: string;
  product_id?: string;
  votes?: number;
  initial_votes?: number;
  status_changed_at?: string;
  workflow_status?: WorkflowStatus;
  description?: RichText;
  visibility?: string;
  url?: string;
  resource?: string;
  product?: RecordRef;
  created_by_user?: User;
  assigned_to_user?: User | null;
  feature?: RecordRef;
  endorsements_count?: number;
  comments_count?: number;
  tags?: string[];
  categories?: unknown[];
  custom_fields?: CustomField[];
  [key: string]: unknown;
}

export interface IdeasListResponse {
  ideas?: Idea[];
  pagination?: Pagination;
}

/**
 * `GET /ideas/{id}` wraps the idea under an `idea` key.
 */
export interface IdeaResponse {
  idea?: Idea;
  [key: string]: unknown;
}

/**
 * Initiative entity.
 */
export interface Initiative {
  id?: string;
  name?: string;
  reference_num?: string;
  status?: string;
  effort?: number;
  value?: number;
  color?: string;
  start_date?: string | null;
  end_date?: string | null;
  position?: number;
  score?: number;
  created_at?: string;
  updated_at?: string;
  product_id?: string;
  progress?: number | null;
  progress_source?: string;
  duration_source?: string;
  url?: string;
  resource?: string;
  workflow_status?: WorkflowStatus;
  description?: RichText;
  assigned_to_user?: User;
  created_by_user?: User;
  comments_count?: number;
  goals?: RecordRef[];
  features?: RecordRef[];
  releases?: RecordRef[];
  custom_fields?: CustomField[];
  [key: string]: unknown;
}

export interface InitiativesListResponse {
  initiatives?: Initiative[];
  pagination?: Pagination;
}

/**
 * `GET /initiatives/{id}` wraps the initiative under an `initiative` key.
 */
export interface InitiativeResponse {
  initiative?: Initiative;
  [key: string]: unknown;
}

/**
 * Goal entity.
 */
export interface Goal {
  id?: string;
  name?: string;
  reference_num?: string;
  effort?: number;
  value?: number;
  color?: string;
  position?: number;
  created_at?: string;
  updated_at?: string;
  product_id?: string;
  status?: string;
  progress?: number | null;
  progress_source?: string;
  url?: string;
  resource?: string;
  description?: RichText;
  success_metric?: unknown;
  time_frame?: unknown;
  project?: RecordRef;
  initiatives?: RecordRef[];
  key_results?: unknown[];
  features?: RecordRef[];
  releases?: RecordRef[];
  comments_count?: number;
  created_by_user?: User;
  custom_fields?: CustomField[];
  [key: string]: unknown;
}

export interface GoalsListResponse {
  goals?: Goal[];
  pagination?: Pagination;
}

/**
 * `GET /goals/{id}` wraps the goal under a `goal` key.
 */
export interface GoalGetResponse {
  goal?: Goal;
  [key: string]: unknown;
}

/**
 * Relationship response: epics associated with a goal.
 */
export interface GoalEpicsResponse {
  epics?: Epic[];
  pagination?: Pagination;
}

/**
 * Release entity.
 */
export interface Release {
  id?: string;
  product_id?: string;
  reference_num?: string;
  name?: string;
  start_date?: string;
  due_date?: string;
  end_date?: string | null;
  development_started_on?: string;
  release_date?: string;
  external_release_date?: string;
  external_release_date_description?: string;
  external_date_resolution?: string;
  released?: boolean;
  parking_lot?: boolean;
  master_release?: boolean;
  created_at?: string;
  updated_at?: string;
  position?: number;
  progress?: number | null;
  progress_source?: string;
  duration_source?: string;
  workflow_status?: WorkflowStatus;
  theme?: RecordRef;
  owner?: User;
  goals?: RecordRef[];
  project?: RecordRef;
  url?: string;
  resource?: string;
  comments_count?: number;
  created_by_user?: User;
  custom_fields?: CustomField[];
  [key: string]: unknown;
}

export interface ReleasesListResponse {
  releases?: Release[];
  pagination?: Pagination;
}

/**
 * `GET /releases/{id}` wraps the release under a `release` key.
 */
export interface ReleaseGetResponse {
  release?: Release;
  [key: string]: unknown;
}

/**
 * Relationship response: features associated with a release.
 */
export interface ReleaseFeaturesResponse {
  features?: Feature[];
  pagination?: Pagination;
}

/**
 * Release Phase entity.
 */
export interface ReleasePhase {
  id?: string;
  name?: string;
  reference_num?: string;
  start_on?: string;
  end_on?: string;
  start_date?: string;
  due_date?: string;
  type?: string;
  release_id?: string;
  created_at?: string;
  updated_at?: string;
  description?: RichText;
  progress?: number;
  progress_source?: string;
  duration_source?: string;
  url?: string;
  resource?: string;
  position?: number;
  custom_fields?: CustomField[];
  [key: string]: unknown;
}

export interface ReleasePhasesListResponse {
  release_phases?: ReleasePhase[];
  pagination?: Pagination;
}

/**
 * Product entity.
 */
export interface Product {
  id?: string;
  reference_prefix?: string;
  name?: string;
  reference_num?: string;
  product_line?: boolean;
  created_at?: string;
  updated_at?: string;
  description?: RichText;
  url?: string;
  resource?: string;
  has_ideas?: boolean;
  has_epics?: boolean;
  has_master_features?: boolean;
  workspace_type?: string;
  color?: string;
  custom_fields?: CustomField[];
  [key: string]: unknown;
}

export interface ProductsListResponse {
  products?: Product[];
  pagination?: Pagination;
}

/**
 * Requirement entity.
 */
export interface Requirement {
  id?: string;
  name?: string;
  reference_num?: string;
  position?: number;
  created_at?: string;
  updated_at?: string;
  release_id?: string;
  start_date?: string;
  end_date?: string;
  due_date?: string;
  created_by_user?: User;
  workflow_status?: WorkflowStatus;
  url?: string;
  resource?: string;
  description?: RichText;
  feature?: RecordRef;
  assigned_to_user?: User;
  tags?: unknown[];
  custom_fields?: CustomField[];
  comments_count?: number;
  [key: string]: unknown;
}

export interface RequirementsListResponse {
  requirements?: Requirement[];
  pagination?: Pagination;
}

/**
 * Todo (task) entity. Aha's newer API renamed `/todos` to `/tasks`; the field shape is
 * unchanged.
 */
export interface Todo {
  id?: string;
  name?: string;
  reference_num?: string;
  due_date?: string;
  status?: string;
  body?: string;
  position?: number;
  product_id?: string;
  assignee?: User;
  assigned_to_users?: User[];
  created_by_user?: User;
  created_at?: string;
  updated_at?: string;
  completed?: boolean;
  completed_at?: string;
  url?: string;
  resource?: string;
  comments_count?: number;
  custom_fields?: CustomField[];
  taskable?: RecordRef;
  [key: string]: unknown;
}

export interface TodosListResponse {
  todos?: Todo[];
  pagination?: Pagination;
}

/**
 * Comment entity, as returned by every `GET /<resource>/{id}/comments` endpoint.
 */
export interface Comment {
  id?: string;
  body?: string;
  created_at?: string;
  updated_at?: string;
  parent_comment_id?: string | null;
  user?: User;
  url?: string;
  resource?: string;
  commentable?: RecordRef;
  [key: string]: unknown;
}

export interface CommentsListResponse {
  comments?: Comment[];
  pagination?: Pagination;
}

/**
 * An idea's *portal* comment, from `GET /ideas/{id}/idea_comments`.
 *
 * Not the same records as `Comment` on an idea, and not a superset either - the two
 * endpoints return disjoint sets. `/ideas/{id}/comments` holds internal comments, which Aha
 * documents as such; `/ideas/{id}/idea_comments` holds the conversation that can reach the
 * ideas portal, including anything a customer wrote. Measured on one live idea: one internal
 * comment, two portal comments, no overlapping ids. Reading only the first silently drops
 * the customer-facing half, which for idea triage is usually the half that matters.
 *
 * `visibility` is the field that distinguishes them, and it reads differently depending on
 * direction: a response carries a human-readable phrase ("Visible to all ideas portal
 * users"), while a create request takes `public` or `employee_or_creator`. Do not assume one
 * vocabulary can be fed back into the other.
 */
export interface IdeaComment {
  id?: string;
  idea_id?: string;
  body?: string;
  /** Human-readable phrase on read, e.g. "Visible to all ideas portal users". */
  visibility?: string;
  created_at?: string;
  updated_at?: string;
  parent_idea_comment_id?: string | null;
  /** Set when the author commented through the ideas portal rather than in Aha. */
  idea_commenter_portal_user?: Record<string, unknown> | null;
  idea_commenter_idea_user?: Record<string, unknown> | null;
  attachments?: unknown[];
  [key: string]: unknown;
}

export interface IdeaCommentsListResponse {
  idea_comments?: IdeaComment[];
  pagination?: Pagination;
}

/** Visibility a new idea portal comment can be created with, per Aha's documented values. */
export type IdeaCommentVisibility = 'public' | 'employee_or_creator';

/**
 * Competitor entity.
 */
export interface Competitor {
  id?: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  description?: RichText | string;
  url?: string;
  resource?: string;
  product_id?: string;
  website?: string;
  strengths?: string;
  weaknesses?: string;
  created_by_user?: User;
  custom_fields?: CustomField[];
  [key: string]: unknown;
}

export interface CompetitorsListResponse {
  competitors?: Competitor[];
  pagination?: Pagination;
}

/**
 * Strategic Model entity (Aha renamed `/strategic_models` to `/strategy_models` upstream;
 * the field shape is unchanged).
 */
export interface StrategicModel {
  id?: string;
  name?: string;
  kind?: string;
  reference_num?: string;
  url?: string;
  resource?: string;
  components?: unknown[];
  description?: unknown;
  project?: RecordRef;
  [key: string]: unknown;
}

export interface StrategicModelsListResponse {
  strategic_models?: StrategicModel[];
  pagination?: Pagination;
}

/**
 * Idea Organization entity.
 */
export interface IdeaOrganization {
  id?: string;
  name?: string;
  revenue?: unknown;
  created_at?: string;
  updated_at?: string;
  description?: RichText;
  created_by_user?: User;
  custom_fields?: CustomField[];
  [key: string]: unknown;
}

export interface IdeaOrganizationsListResponse {
  idea_organizations?: IdeaOrganization[];
  pagination?: Pagination;
}

/**
 * Idea endorsement (Aha models votes and endorsements as the same underlying record;
 * `getIdeaVotes` and `getIdeaEndorsements` both return this shape).
 */
export interface IdeaEndorsement {
  id?: string;
  idea_id?: string;
  created_at?: string;
  updated_at?: string;
  value?: unknown;
  weight?: number;
  endorsed_by_portal_user?: RecordRef;
  endorsed_by_idea_user?: RecordRef;
  idea_organization?: RecordRef;
  [key: string]: unknown;
}

export interface IdeaEndorsementsResponse {
  idea_endorsements?: IdeaEndorsement[];
  pagination?: Pagination;
}

export interface IdeaVotesResponse {
  idea_endorsements?: IdeaEndorsement[];
  pagination?: Pagination;
}

/**
 * `GET /me/assigned` - records assigned to the current user.
 */
export interface MeAssignedRecordsResponse {
  records?: RecordRef[];
  pagination?: Pagination;
  [key: string]: unknown;
}

/**
 * `GET /me/tasks` - to-dos pending for the current user.
 */
export interface MePendingTasksResponse {
  tasks?: Todo[];
  pagination?: Pagination;
  [key: string]: unknown;
}
