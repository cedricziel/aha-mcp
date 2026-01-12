/**
 * Service exports and provider for dependency injection
 */

import { AhaService } from './aha-service.js';
import { MockAhaService } from './aha-service.mock.js';
import type { IAhaService } from './aha-service.interface.js';

// Auto-detect test mode and use mock service
const isTestMode = process.env.NODE_ENV === 'test' && process.env.AHA_TOKEN === 'test-token';
let serviceInstance: IAhaService = isTestMode ? new MockAhaService() : AhaService;

/**
 * Get the current AhaService instance (real or mock)
 */
export function getAhaService(): IAhaService {
  return serviceInstance;
}

/**
 * Set a custom AhaService implementation (for testing)
 */
export function setAhaService(service: IAhaService): void {
  serviceInstance = service;
}

/**
 * Use the mock AhaService implementation
 */
export function useMockAhaService(): void {
  serviceInstance = new MockAhaService();
}

/**
 * Reset to the real AhaService implementation
 */
export function useRealAhaService(): void {
  serviceInstance = AhaService;
}

// Export the services
export { AhaService } from './aha-service.js';
export { MockAhaService } from './aha-service.mock.js';
export type { IAhaService } from './aha-service.interface.js';
export * from './sync-service.js';
export * from './embedding-service.js';

// Export database service
export * from '../database/database.js';
