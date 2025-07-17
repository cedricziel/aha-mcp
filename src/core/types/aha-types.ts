/**
 * Custom types for Aha.io API responses not covered by the SDK
 */

import { User, Epic, Feature } from '@cedricziel/aha-js';

/**
 * Release entity (not available in SDK)
 */
export interface Release {
  id?: string;
  name?: string;
  reference_num?: string;
  start_date?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  description?: string;
  url?: string;
  resource?: string;
  product_id?: string;
  position?: number;
  released?: boolean;
  created_by_user?: User;
}

/**
 * Release Phase entity (not available in SDK)
 */
export interface ReleasePhase {
  id?: string;
  name?: string;
  reference_num?: string;
  start_date?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  description?: string;
  url?: string;
  resource?: string;
  release_id?: string;
  position?: number;
}

/**
 * Goal entity (not available in SDK)
 */
export interface Goal {
  id?: string;
  name?: string;
  reference_num?: string;
  created_at?: string;
  updated_at?: string;
  description?: string;
  url?: string;
  resource?: string;
  product_id?: string;
  position?: number;
  status?: string;
  created_by_user?: User;
}

/**
 * Product entity (not available in SDK)
 */
export interface Product {
  id?: string;
  name?: string;
  reference_num?: string;
  created_at?: string;
  updated_at?: string;
  description?: string;
  url?: string;
  resource?: string;
}

/**
 * List response wrappers for entities not in SDK
 */
export interface ReleasesListResponse {
  releases?: Release[];
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
}

export interface ReleasesPhasesListResponse {
  release_phases?: ReleasePhase[];
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
}

export interface GoalsListResponse {
  goals?: Goal[];
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
}

export interface UsersListResponse {
  users?: User[];
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
}

/**
 * Relationship response types
 */
export interface ReleaseFeaturesResponse {
  features?: Feature[];
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
}

export interface ReleaseEpicsResponse {
  epics?: Epic[];
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
}

export interface GoalEpicsResponse {
  epics?: Epic[];
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
}

/**
 * Ideas by product response (not fully typed in SDK)
 */
export interface IdeasByProductResponse {
  ideas?: Array<{
    id?: string;
    name?: string;
    reference_num?: string;
    created_at?: string;
    updated_at?: string;
    description?: string;
    url?: string;
    resource?: string;
  }>;
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
}

/**
 * Requirement entity (not available in SDK)
 */
export interface Requirement {
  id?: string;
  name?: string;
  reference_num?: string;
  created_at?: string;
  updated_at?: string;
  description?: string;
  url?: string;
  resource?: string;
  feature_id?: string;
  position?: number;
  created_by_user?: User;
}

/**
 * Todo entity (not available in SDK)
 */
export interface Todo {
  id?: string;
  name?: string;
  reference_num?: string;
  created_at?: string;
  updated_at?: string;
  description?: string;
  url?: string;
  resource?: string;
  assignee?: User;
  due_date?: string;
  completed?: boolean;
  completed_at?: string;
  created_by_user?: User;
}

/**
 * List response wrappers for Requirements and Todos
 */
export interface RequirementsListResponse {
  requirements?: Requirement[];
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
}

export interface TodosListResponse {
  todos?: Todo[];
  pagination?: {
    total_records?: number;
    total_pages?: number;
    current_page?: number;
  };
}