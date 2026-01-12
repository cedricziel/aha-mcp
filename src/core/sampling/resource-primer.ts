/**
 * Resource discovery primers for MCP sampling
 */

import { ResourcePrimer } from './types.js';

/**
 * Detect common synonyms and terminology in user queries
 */
export function detectTerminology(query: string): {
  synonyms: string[];
  canonical: string[];
} {
  const lowerQuery = query.toLowerCase();
  const synonyms: string[] = [];
  const canonical: string[] = [];

  // Workspace/Product detection
  if (lowerQuery.includes('workspace') || lowerQuery.includes('workspaces')) {
    synonyms.push('workspace');
    canonical.push('product');
  }

  // Product Area detection (case-insensitive)
  if (lowerQuery.match(/product\s*area/i) || lowerQuery.includes('area')) {
    synonyms.push('Product Area');
    canonical.push('product_area');
  }

  // Workstream detection
  if (lowerQuery.includes('workstream') || lowerQuery.includes('work stream')) {
    synonyms.push('workstream');
    canonical.push('release');
  }

  return { synonyms, canonical };
}

/**
 * Generate a primer for product/workspace discovery
 */
export function generateProductWorkspacePrimer(query: string): ResourcePrimer {
  return {
    message: `I notice you're looking for workspaces. In Aha.io, **products and workspaces are synonymous** - they're the same thing. Let me guide you to the right resources.`,
    suggestedResources: [
      'aha://products - List all products/workspaces',
      'aha://product/{id} - Get a specific product/workspace by ID'
    ],
    exampleUris: [
      'aha://products?page=1&perPage=50',
      'aha://product/PROD-1'
    ],
    workflow: [
      '1. First, list all products: aha://products',
      '2. Find the product/workspace you need from the results',
      '3. Access specific product details: aha://product/{id}',
      '4. Then access nested resources like releases, epics, or ideas for that product'
    ]
  };
}

/**
 * Generate a primer for Product Area discovery
 */
export function generateProductAreaPrimer(query: string): ResourcePrimer {
  return {
    message: `I notice you're looking for Product Areas. Currently, **Product Areas are not exposed as resources** in this MCP server. Product Areas are organizational subdivisions within products/workspaces in Aha.io.

Here's what you can do instead:`,
    suggestedResources: [
      'aha://products - List all products (which contain Product Areas)',
      'aha://product/{id} - Get product details (may include Product Area information in the response)'
    ],
    exampleUris: [
      'aha://products',
      'aha://product/PROD-1'
    ],
    workflow: [
      '1. List products first: aha://products',
      '2. Select the product that contains your Product Areas',
      '3. Note: Product Area-specific resources are not yet available, but the product response may include area information'
    ]
  };
}

/**
 * Generate a primer for workstream/release discovery
 */
export function generateWorkstreamPrimer(query: string): ResourcePrimer {
  return {
    message: `I notice you're looking for workstreams. In Aha.io, **releases can function as workstreams** for organizing features and epics.`,
    suggestedResources: [
      'aha://releases - List all releases/workstreams',
      'aha://release/{id} - Get a specific release/workstream',
      'aha://releases/{product_id} - List releases for a specific product'
    ],
    exampleUris: [
      'aha://releases?status=active&page=1',
      'aha://release/PROJ-R-1',
      'aha://releases/PROD-1'
    ],
    workflow: [
      '1. List releases: aha://releases (optionally filtered by product)',
      '2. Get release details: aha://release/{id}',
      '3. Access release features: aha://release/{id}/features',
      '4. Access release epics: aha://release/{id}/epics'
    ]
  };
}

/**
 * Generate a general resource discovery primer
 */
export function generateDiscoveryPrimer(): ResourcePrimer {
  return {
    message: `Let me help you discover available resources. Start with the resource guide to understand the terminology and find what you need.`,
    suggestedResources: [
      'aha://resources - Complete resource guide with synonym mappings',
      'aha://products - List all products/workspaces',
      'aha://features - Search features globally',
      'aha://ideas - Search ideas globally',
      'aha://releases - List all releases'
    ],
    exampleUris: [
      'aha://resources',
      'aha://products',
      'aha://features?query=authentication&page=1',
      'aha://ideas?status=active'
    ],
    workflow: [
      '1. Check aha://resources to understand available resources and terminology',
      '2. Start with top-level resources like products, features, ideas, or releases',
      '3. Navigate to nested resources once you have IDs (e.g., product → releases → features)',
      '4. Use query parameters for filtering and pagination'
    ]
  };
}

/**
 * Analyze a query and generate the appropriate primer
 */
export function analyzeAndPrime(query: string): ResourcePrimer | null {
  const lowerQuery = query.toLowerCase();
  const terminology = detectTerminology(query);

  // Check for workspace queries
  if (terminology.synonyms.includes('workspace')) {
    return generateProductWorkspacePrimer(query);
  }

  // Check for Product Area queries
  if (terminology.synonyms.includes('Product Area')) {
    return generateProductAreaPrimer(query);
  }

  // Check for workstream queries
  if (terminology.synonyms.includes('workstream')) {
    return generateWorkstreamPrimer(query);
  }

  // General discovery queries
  if (
    lowerQuery.includes('how do i find') ||
    lowerQuery.includes('where can i') ||
    lowerQuery.includes('how to access') ||
    lowerQuery.includes('show me available') ||
    lowerQuery.includes('what resources')
  ) {
    return generateDiscoveryPrimer();
  }

  return null;
}

/**
 * Format a primer as a user-friendly message
 */
export function formatPrimer(primer: ResourcePrimer): string {
  let formatted = `${primer.message}\n\n`;

  formatted += `**Suggested Resources:**\n`;
  primer.suggestedResources.forEach(resource => {
    formatted += `- ${resource}\n`;
  });

  formatted += `\n**Example URIs:**\n`;
  primer.exampleUris.forEach(uri => {
    formatted += `- ${uri}\n`;
  });

  if (primer.workflow && primer.workflow.length > 0) {
    formatted += `\n**Recommended Workflow:**\n`;
    primer.workflow.forEach(step => {
      formatted += `${step}\n`;
    });
  }

  return formatted;
}
