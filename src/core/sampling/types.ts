/**
 * Types for MCP sampling functionality
 */

export interface SamplingContext {
  userQuery?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  detectedIntent?: 'discovery' | 'search' | 'retrieve' | 'navigate';
}

export interface ResourcePrimer {
  message: string;
  suggestedResources: string[];
  exampleUris: string[];
  workflow?: string[];
}
