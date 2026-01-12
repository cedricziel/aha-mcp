/**
 * MCP Sampling implementation for resource discovery priming
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { analyzeAndPrime, formatPrimer } from './sampling/resource-primer.js';

/**
 * Register sampling handlers with the MCP server
 * @param server The MCP server instance
 */
export function registerSampling(server: McpServer) {
  // Note: The current MCP SDK (v1.18.2) doesn't directly support sampling/createMessage
  // request handlers. This is a forward-looking implementation for when the SDK
  // adds full sampling support, or for custom implementations.

  // For now, we can provide sampling guidance through prompts and resources.
  // When the SDK supports it, this handler will be activated.

  try {
    // Check if setRequestHandler supports sampling
    if (typeof (server as any).setRequestHandler === 'function') {
      (server as any).setRequestHandler("sampling/createMessage", async (request: any) => {
        // Extract the messages from the request
        const messages = request.params?.messages || [];

        // Look at the last user message to understand context
        const lastUserMessage = messages
          .filter((m: any) => m.role === 'user')
          .pop();

        if (!lastUserMessage) {
          return {
            role: 'assistant',
            content: {
              type: 'text',
              text: 'I can help you discover and use Aha.io resources. What would you like to find?'
            }
          };
        }

        const userQuery = typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : lastUserMessage.content?.text || '';

        // Analyze the query and generate a primer if applicable
        const primer = analyzeAndPrime(userQuery);

        if (primer) {
          // Return a priming message to guide the model
          return {
            role: 'assistant',
            content: {
              type: 'text',
              text: formatPrimer(primer)
            }
          };
        }

        // No specific primer needed, return general guidance
        return {
          role: 'assistant',
          content: {
            type: 'text',
            text: `I can help you access Aha.io resources. Some common starting points:

- **aha://resources** - View the complete resource guide with terminology mappings
- **aha://products** - List all products/workspaces
- **aha://features** - Search features across all products
- **aha://ideas** - Search ideas and feedback
- **aha://releases** - List releases/workstreams

What would you like to explore?`
          }
        };
      });
    }
  } catch (error) {
    // Sampling not supported in current SDK version - that's okay
    // The resource guide and enhanced descriptions will still help
    console.log('Sampling handler registration skipped (not yet supported in SDK)');
  }
}

/**
 * Generate a sampling primer message based on detected terminology
 * This can be called from prompts or other parts of the system
 * @param query The user's query
 * @returns A formatted primer message, or null if no primer is needed
 */
export function getSamplingPrimer(query: string): string | null {
  const primer = analyzeAndPrime(query);
  return primer ? formatPrimer(primer) : null;
}
