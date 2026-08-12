import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import * as z from "zod/v4";
import * as services from "./services/index.js";
import { getSamplingPrimer } from "./sampling.js";
import {
  completeProduct,
  completeRecordReference,
  completeRecordReferenceList
} from "./completions.js";

/**
 * Helper function to fetch context from Aha.io resources
 */
async function fetchResourceContext(resourceId: string, resourceType: string): Promise<string> {
  try {
    let context = "";
    
    switch (resourceType) {
      case "feature":
        const feature = await services.AhaService.getFeature(resourceId);
        context = `**Existing Feature Context:**
- Name: ${feature.name || 'N/A'}
- Description: ${feature.description || 'N/A'}
- Status: ${(feature as any).status || 'N/A'}
- Priority: ${(feature as any).priority || 'N/A'}
- Release: ${(feature as any).release?.name || 'N/A'}
- Tags: ${feature.tags?.map(t => (t as any).name).join(', ') || 'N/A'}
`;
        break;
      case "epic":
        const epic = await services.AhaService.getEpic(resourceId);
        context = `**Existing Epic Context:**
- Name: ${epic.name || 'N/A'}
- Description: ${epic.description || 'N/A'}
- Status: ${(epic as any).status || 'N/A'}
- Progress: ${(epic as any).progress || 'N/A'}
- Product: ${(epic as any).product?.name || 'N/A'}
`;
        break;
      case "idea":
        const idea = await services.AhaService.getIdea(resourceId);
        context = `**Existing Idea Context:**
- Name: ${(idea as any).name || 'N/A'}
- Description: ${(idea as any).description || 'N/A'}
- Status: ${(idea as any).status || 'N/A'}
- Score: ${(idea as any).score || 'N/A'}
- Category: ${(idea as any).category?.name || 'N/A'}
`;
        break;
      case "initiative":
        const initiative = await services.AhaService.getInitiative(resourceId);
        context = `**Existing Initiative Context:**
- Name: ${(initiative as any).name || 'N/A'}
- Description: ${(initiative as any).description || 'N/A'}
- Status: ${(initiative as any).status || 'N/A'}
- Progress: ${(initiative as any).progress || 'N/A'}
`;
        break;
      case "product":
        const product = await services.AhaService.getProduct(resourceId);
        context = `**Existing Product Context:**
- Name: ${product.name || 'N/A'}
- Description: ${product.description || 'N/A'}
- Prefix: ${(product as any).prefix || 'N/A'}
`;
        break;
      default:
        context = "";
    }
    
    return context;
  } catch (error) {
    console.error(`Error fetching ${resourceType} context for ${resourceId}:`, error);
    return "";
  }
}

/**
 * Register all Aha.io domain-specific prompts with the MCP server
 * @param server The MCP server instance
 */
export function registerPrompts(server: McpServer) {

  // 1. Feature Analysis Prompt
  server.registerPrompt(
    "feature_analysis",
    {
      title: "Analyze a feature",
      description: "Analyze feature requirements, dependencies, and implementation strategies",
      argsSchema: {
        feature_name: z.string().describe("Name of the feature to analyze"),
        feature_description: z.string().optional().describe("Description of the feature"),
        product_context: z.string().optional().describe("Product context and goals"),
        existing_features: z.string().optional().describe("Comma-separated list of related existing features"),
        target_users: z.string().optional().describe("Target user segments"),
        known_risks: z.string().optional().describe("Comma-separated list of risks already identified"),
        current_baseline: z.string().optional().describe("Current baseline metrics, if any exist to improve on"),
        feature_id: completable(
          z.string().optional().describe("Existing feature ID from Aha.io for context (e.g., PROJ-123)"),
          completeRecordReference("Feature")
        )
      }
    },
    async (params: { feature_name: string; feature_description?: string; product_context?: string; existing_features?: string; target_users?: string; known_risks?: string; current_baseline?: string; feature_id?: string }) => {
      // Fetch existing feature context if feature_id is provided
      let existingFeatureContext = "";
      if (params.feature_id) {
        existingFeatureContext = await fetchResourceContext(params.feature_id, "feature");
      }
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please analyze the following feature:

**Feature Name**: ${params.feature_name}
${params.feature_description ? `**Description**: ${params.feature_description}` : ''}
${params.product_context ? `**Product Context**: ${params.product_context}` : ''}
${params.existing_features ? `**Related Features**: ${params.existing_features}` : ''}
${params.target_users ? `**Target Users**: ${params.target_users}` : ''}
${params.known_risks ? `**Risks Already Identified**: ${params.known_risks}` : ''}
${params.current_baseline ? `**Current Baseline**: ${params.current_baseline}` : ''}

${existingFeatureContext}

Please provide:
1. **Requirements Analysis**: Break down the feature into core requirements
2. **Dependencies**: Identify technical and feature dependencies
3. **Implementation Strategy**: Recommend approach and phases
4. **Risk Assessment**: Identify risks, categorise them by type (technical, resource,
   market, dependency), rate each by impact and likelihood, and give a mitigation for the
   ones that rank highest. Say which indicators would show a risk materialising.
5. **Success Metrics**: Define primary metrics that indicate success, secondary and leading
   indicators that move earlier, and how each would be measured. Note where no baseline
   exists to compare against.
6. **Timeline Estimation**: Provide rough timeline estimates

Format your response with clear sections and actionable recommendations.`
          }
        }]
      };
    }
  );

  // 2. Product Roadmap Prompt
  server.registerPrompt(
    "product_roadmap",
    {
      title: "Plan a product roadmap",
      description: "Generate product roadmap recommendations and strategic planning",
      argsSchema: {
        product_name: completable(
          z.string().describe("Name of the product"),
          completeProduct("name")
        ),
        current_version: z.string().optional().describe("Current product version"),
        business_goals: z.string().describe("Business goals and objectives"),
        time_horizon: z.string().describe("Roadmap time horizon (quarter, half-year, year)"),
        key_features: z.string().optional().describe("Comma-separated list of key features to consider"),
        market_constraints: z.string().optional().describe("Market constraints and competitive landscape"),
        product_id: completable(
          z.string().optional().describe("Existing product ID from Aha.io for context (e.g., PROJ)"),
          completeProduct("reference_prefix")
        )
      }
    },
    async (params: { product_name: string; current_version?: string; business_goals: string; time_horizon: string; key_features?: string; market_constraints?: string; product_id?: string }) => {
      // Fetch existing product context if product_id is provided
      let existingProductContext = "";
      if (params.product_id) {
        existingProductContext = await fetchResourceContext(params.product_id, "product");
      }
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Create a strategic product roadmap for:

**Product**: ${params.product_name}
${params.current_version ? `**Current Version**: ${params.current_version}` : ''}
**Business Goals**: ${params.business_goals}
**Time Horizon**: ${params.time_horizon}
${params.key_features ? `**Key Features**: ${params.key_features}` : ''}
${params.market_constraints ? `**Market Context**: ${params.market_constraints}` : ''}

${existingProductContext}

Please provide:
1. **Strategic Themes**: 3-4 key themes for the roadmap period
2. **Milestone Planning**: Major milestones and deliverables
3. **Feature Prioritization**: Recommended feature priorities with rationale
4. **Resource Allocation**: Resource requirements and team considerations
5. **Risk Assessment**: Key risks and contingency plans
6. **Success Metrics**: KPIs and success measures for each phase

Structure as a actionable roadmap with clear timelines and dependencies.`
          }
        }]
      };
    }
  );

  // 3. Release Planning Prompt
  server.registerPrompt(
    "release_planning",
    {
      title: "Plan a release",
      description: "Create comprehensive release planning strategies and execution plans",
      argsSchema: {
        release_name: z.string().describe("Name of the release"),
        release_goals: z.string().describe("Primary goals for this release"),
        features_list: z.string().describe("Comma-separated list of features to include"),
        timeline: z.string().describe("Target timeline or deadline"),
        team_capacity: z.string().optional().describe("Team capacity and constraints"),
        dependencies: z.string().optional().describe("Comma-separated list of external dependencies")
      }
    },
    (params: { release_name: string; release_goals: string; features_list: string; timeline: string; team_capacity?: string; dependencies?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Plan the following release:

**Release Name**: ${params.release_name}
**Release Goals**: ${params.release_goals}
**Features**: ${params.features_list}
**Timeline**: ${params.timeline}
${params.team_capacity ? `**Team Capacity**: ${params.team_capacity}` : ''}
${params.dependencies ? `**Dependencies**: ${params.dependencies}` : ''}

Please provide:
1. **Release Scope**: Detailed scope definition and boundaries
2. **Feature Breakdown**: Break features into epics and stories
3. **Sprint Planning**: Recommended sprint structure and allocation
4. **Risk Management**: Identify risks and mitigation strategies
5. **Quality Assurance**: Testing strategy and acceptance criteria
6. **Release Logistics**: Deployment and rollout recommendations
7. **Success Criteria**: Define release success metrics

Format as a comprehensive release plan with clear action items.`
        }
      }]
    })
  );

  // 4. Competitor Analysis Prompt
  server.registerPrompt(
    "competitor_analysis",
    {
      title: "Analyze a competitor",
      description: "Analyze competitor features, positioning, and strategic implications",
      argsSchema: {
        competitor_name: z.string().describe("Name of the competitor"),
        product_category: z.string().describe("Product category or market segment"),
        focus_areas: z.string().optional().describe("Comma-separated list of specific areas to analyze"),
        our_product: z.string().optional().describe("Our product for comparison"),
        analysis_purpose: z.string().describe("Purpose of the analysis (e.g., feature gap, positioning, strategy)")
      }
    },
    (params: { competitor_name: string; product_category: string; focus_areas?: string; our_product?: string; analysis_purpose: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Analyze the following competitor:

**Competitor**: ${params.competitor_name}
**Product Category**: ${params.product_category}
**Analysis Purpose**: ${params.analysis_purpose}
${params.focus_areas ? `**Focus Areas**: ${params.focus_areas}` : ''}
${params.our_product ? `**Our Product**: ${params.our_product}` : ''}

Please provide:
1. **Competitive Positioning**: How they position themselves in the market
2. **Feature Analysis**: Key features and capabilities analysis
3. **Strengths & Weaknesses**: Competitive advantages and gaps
4. **Pricing Strategy**: Pricing model and positioning
5. **Market Approach**: Go-to-market and customer acquisition strategy
6. **Differentiation Opportunities**: Areas where we can differentiate
7. **Strategic Recommendations**: Actionable insights for our product strategy

Focus on actionable insights that can inform our product decisions.`
        }
      }]
    })
  );

  // 5. User Story Generation Prompt
  server.registerPrompt(
    "user_story_generation",
    {
      title: "Write user stories",
      description: "Generate comprehensive user stories from requirements and acceptance criteria",
      argsSchema: {
        feature_name: z.string().describe("Name of the feature"),
        user_personas: z.string().describe("Comma-separated list of target user personas"),
        requirements: z.string().describe("High-level requirements or epic description"),
        acceptance_criteria: z.string().optional().describe("Specific acceptance criteria"),
        constraints: z.string().optional().describe("Technical or business constraints")
      }
    },
    (params: { feature_name: string; user_personas: string; requirements: string; acceptance_criteria?: string; constraints?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Generate user stories for:

**Feature**: ${params.feature_name}
**User Personas**: ${params.user_personas}
**Requirements**: ${params.requirements}
${params.acceptance_criteria ? `**Acceptance Criteria**: ${params.acceptance_criteria}` : ''}
${params.constraints ? `**Constraints**: ${params.constraints}` : ''}

Please provide:
1. **Epic Story**: High-level epic story that captures the overall feature
2. **User Stories**: Detailed user stories in "As a... I want... So that..." format
3. **Acceptance Criteria**: Specific, testable acceptance criteria for each story
4. **Story Sizing**: Relative sizing estimates (S/M/L or story points)
5. **Priority Ranking**: Recommended priority order with rationale
6. **Dependencies**: Inter-story dependencies and prerequisites
7. **Definition of Done**: Clear completion criteria

Format each story following best practices with clear, actionable descriptions.`
        }
      }]
    })
  );

  // 6. Sprint Planning Prompt
  server.registerPrompt(
    "sprint_planning",
    {
      title: "Plan a sprint",
      description: "Create sprint planning recommendations and capacity allocation",
      argsSchema: {
        sprint_duration: z.string().describe("Sprint duration (e.g., 2 weeks)"),
        team_capacity: z.string().describe("Team capacity and availability"),
        backlog_items: z.string().describe("Comma-separated list of prioritized backlog items"),
        sprint_goals: z.string().describe("Sprint goals and objectives"),
        previous_velocity: z.string().optional().describe("Previous sprint velocity data"),
        constraints: z.string().optional().describe("Sprint constraints or dependencies")
      }
    },
    (params: { sprint_duration: string; team_capacity: string; backlog_items: string; sprint_goals: string; previous_velocity?: string; constraints?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Plan the following sprint:

**Sprint Duration**: ${params.sprint_duration}
**Team Capacity**: ${params.team_capacity}
**Sprint Goals**: ${params.sprint_goals}
**Backlog Items**: ${params.backlog_items}
${params.previous_velocity ? `**Previous Velocity**: ${params.previous_velocity}` : ''}
${params.constraints ? `**Constraints**: ${params.constraints}` : ''}

Please provide:
1. **Sprint Scope**: Recommended items to include in the sprint
2. **Capacity Planning**: Team capacity allocation and workload distribution
3. **Story Breakdown**: Break down large items into sprint-sized tasks
4. **Risk Assessment**: Identify sprint risks and mitigation strategies
5. **Definition of Done**: Sprint completion criteria and quality gates
6. **Daily Standup Structure**: Recommended daily standup format and focus areas
7. **Sprint Review Planning**: Deliverables and demonstration planning

Format as a actionable sprint plan with clear assignments and timelines.`
        }
      }]
    })
  );

  // 7. Epic Breakdown Prompt
  server.registerPrompt(
    "epic_breakdown",
    {
      title: "Break down an epic",
      description: "Break down epics into manageable features and user stories",
      argsSchema: {
        epic_name: z.string().describe("Name of the epic"),
        epic_description: z.string().describe("Detailed epic description"),
        business_value: z.string().describe("Business value and objectives"),
        user_types: z.string().describe("Comma-separated list of user types affected"),
        constraints: z.string().optional().describe("Technical or business constraints"),
        timeline: z.string().optional().describe("Target timeline or deadline"),
        epic_id: completable(
          z.string().optional().describe("Existing epic ID from Aha.io for context (e.g., PROJ-E-123)"),
          completeRecordReference("Epic")
        )
      }
    },
    async (params: { epic_name: string; epic_description: string; business_value: string; user_types: string; constraints?: string; timeline?: string; epic_id?: string }) => {
      // Fetch existing epic context if epic_id is provided
      let existingEpicContext = "";
      if (params.epic_id) {
        existingEpicContext = await fetchResourceContext(params.epic_id, "epic");
      }
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Break down the following epic:

**Epic Name**: ${params.epic_name}
**Description**: ${params.epic_description}
**Business Value**: ${params.business_value}
**User Types**: ${params.user_types}
${params.constraints ? `**Constraints**: ${params.constraints}` : ''}
${params.timeline ? `**Timeline**: ${params.timeline}` : ''}

${existingEpicContext}

Please provide:
1. **Epic Decomposition**: Break into logical features and sub-epics
2. **Story Mapping**: Create a user story map showing user journey
3. **Prioritization**: Recommend priority order with MVP identification
4. **Dependencies**: Identify inter-feature dependencies
5. **Acceptance Criteria**: High-level acceptance criteria for each feature
6. **Effort Estimation**: Rough effort estimates and complexity assessment
7. **Delivery Strategy**: Recommended delivery approach and phasing

Structure as a hierarchical breakdown with clear relationships and dependencies.`
          }
        }]
      };
    }
  );

  // 8. Idea Prioritization Prompt
  server.registerPrompt(
    "idea_prioritization",
    {
      title: "Prioritize ideas",
      description: "Prioritize ideas based on strategic criteria and business value",
      argsSchema: {
        ideas_list: z.string().describe("Comma-separated list of ideas to prioritize"),
        business_goals: z.string().describe("Current business goals and strategy"),
        evaluation_criteria: z.string().optional().describe("Comma-separated list of evaluation criteria"),
        constraints: z.string().optional().describe("Resource or timeline constraints"),
        market_context: z.string().optional().describe("Market context and competitive landscape"),
        idea_ids: completable(
          z.string().optional().describe("Comma-separated list of Aha.io idea IDs for context (e.g., PROJ-I-123,PROJ-I-456)"),
          completeRecordReferenceList("Idea")
        )
      }
    },
    async (params: { ideas_list: string; business_goals: string; evaluation_criteria?: string; constraints?: string; market_context?: string; idea_ids?: string }) => {
      // Fetch existing idea contexts if idea_ids is provided
      let existingIdeasContext = "";
      if (params.idea_ids) {
        const ideaIds = params.idea_ids.split(',').map(id => id.trim());
        const contexts = await Promise.all(
          ideaIds.map(id => fetchResourceContext(id, "idea"))
        );
        existingIdeasContext = contexts.filter(c => c).join('\n');
      }
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Prioritize the following ideas:

**Ideas**: ${params.ideas_list}
**Business Goals**: ${params.business_goals}
${params.evaluation_criteria ? `**Evaluation Criteria**: ${params.evaluation_criteria}` : ''}
${params.constraints ? `**Constraints**: ${params.constraints}` : ''}
${params.market_context ? `**Market Context**: ${params.market_context}` : ''}

${existingIdeasContext}

Please provide:
1. **Prioritization Matrix**: Score each idea against key criteria
2. **Business Impact**: Assess potential business value and impact
3. **Implementation Effort**: Estimate effort and complexity for each idea
4. **Risk Assessment**: Identify risks and uncertainty factors
5. **Strategic Alignment**: Evaluate alignment with business goals
6. **Recommendation**: Final prioritization with rationale
7. **Implementation Roadmap**: Suggested sequence and timing

Use a structured scoring approach with clear rationale for each decision.`
          }
        }]
      };
    }
  );

  // 9. Stakeholder Communication Prompt
  server.registerPrompt(
    "stakeholder_communication",
    {
      title: "Draft a stakeholder update",
      description: "Generate stakeholder updates and communication materials",
      argsSchema: {
        communication_type: z.string().describe("Type of communication (status_update, milestone_report, roadmap_presentation, issue_escalation)"),
        audience: z.string().describe("Target audience (executives, team, customers, etc.)"),
        project_status: z.string().describe("Current project or feature status"),
        key_achievements: z.string().optional().describe("Comma-separated list of key achievements to highlight"),
        challenges: z.string().optional().describe("Comma-separated list of current challenges or blockers"),
        next_steps: z.string().optional().describe("Planned next steps")
      }
    },
    (params: { communication_type: string; audience: string; project_status: string; key_achievements?: string; challenges?: string; next_steps?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Create stakeholder communication:

**Communication Type**: ${params.communication_type}
**Audience**: ${params.audience}
**Project Status**: ${params.project_status}
${params.key_achievements ? `**Key Achievements**: ${params.key_achievements}` : ''}
${params.challenges ? `**Challenges**: ${params.challenges}` : ''}
${params.next_steps ? `**Next Steps**: ${params.next_steps}` : ''}

Please provide:
1. **Executive Summary**: Concise overview tailored to audience
2. **Progress Highlights**: Key achievements and milestones reached
3. **Current Status**: Clear status update with metrics where appropriate
4. **Challenges & Risks**: Transparent view of current challenges
5. **Action Items**: Clear next steps and required decisions
6. **Timeline Updates**: Any timeline changes or implications
7. **Resource Requirements**: Any additional resources needed

Format appropriately for the audience level and communication type.`
        }
      }]
    })
  );

  // 10. Feature Specification Prompt
  server.registerPrompt(
    "feature_specification",
    {
      title: "Write a feature spec",
      description: "Create detailed feature specifications and technical requirements",
      argsSchema: {
        feature_name: z.string().describe("Name of the feature"),
        user_stories: z.string().describe("Comma-separated list of related user stories"),
        functional_requirements: z.string().describe("Functional requirements"),
        non_functional_requirements: z.string().optional().describe("Non-functional requirements"),
        technical_constraints: z.string().optional().describe("Technical constraints"),
        integration_points: z.string().optional().describe("Comma-separated list of integration points with other systems")
      }
    },
    (params: { feature_name: string; user_stories: string; functional_requirements: string; non_functional_requirements?: string; technical_constraints?: string; integration_points?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Create detailed specification for:

**Feature**: ${params.feature_name}
**User Stories**: ${params.user_stories}
**Functional Requirements**: ${params.functional_requirements}
${params.non_functional_requirements ? `**Non-Functional Requirements**: ${params.non_functional_requirements}` : ''}
${params.technical_constraints ? `**Technical Constraints**: ${params.technical_constraints}` : ''}
${params.integration_points ? `**Integration Points**: ${params.integration_points}` : ''}

Please provide:
1. **Feature Overview**: Comprehensive feature description and purpose
2. **Detailed Requirements**: Specific functional and non-functional requirements
3. **User Interface**: UI/UX requirements and wireframe descriptions
4. **Technical Architecture**: Technical approach and system design
5. **Data Requirements**: Data models and storage requirements
6. **Integration Specifications**: API and integration requirements
7. **Testing Strategy**: Test cases and quality assurance approach
8. **Acceptance Criteria**: Detailed, testable acceptance criteria

Format as a comprehensive specification document with clear sections.`
        }
      }]
    })
  );

  // 11. Risk Assessment Prompt

  // 12. Success Metrics Prompt

  // 13. Product Idea Discovery Prompt
  server.registerPrompt(
    "product_idea_discovery",
    {
      title: "Discover ideas in a product",
      description: "Discover and analyze ideas within products/workspaces based on topics, themes, or keywords",
      argsSchema: {
        search_topic: z.string().describe("The topic, theme, or keyword to search for (e.g., 'Node.js', 'mobile', 'API')"),
        product_name: completable(
          z.string().optional().describe("Name of the product/workspace to search in (e.g., 'VoC', 'Platform')"),
          completeProduct("name")
        ),
        product_id: completable(
          z.string().optional().describe("Specific product ID to search in (e.g., 'VOC-1')"),
          completeProduct("reference_prefix")
        ),
        analysis_focus: z.string().optional().describe("What aspect to focus on (e.g., 'customer pain points', 'feature gaps', 'enhancement opportunities')"),
        time_filter: z.string().optional().describe("Time filter for ideas (e.g., 'last 6 months', 'recent', 'all time')"),
        include_status: z.string().optional().describe("Comma-separated list of idea statuses to include (e.g., 'new,under review,planned')")
      }
    },
    async (params: { search_topic: string; product_name?: string; product_id?: string; analysis_focus?: string; time_filter?: string; include_status?: string }) => {
      // Fetch product context if product_id is provided
      let productContext = "";
      if (params.product_id) {
        productContext = await fetchResourceContext(params.product_id, "product");
      }
      
      // Build search instructions based on available parameters
      const searchInstructions = [];
      
      if (params.product_name || params.product_id) {
        searchInstructions.push(`1. **Find Product**: ${params.product_name ? `Search for the "${params.product_name}" product/workspace` : `Use product ID "${params.product_id}"`}`);
      } else {
        searchInstructions.push(`1. **Find Products**: First list all products to identify relevant workspaces`);
      }
      
      searchInstructions.push(`2. **Search Ideas**: Look for ideas related to "${params.search_topic}" using the appropriate resource`);
      searchInstructions.push(`3. **Filter Results**: Apply any additional filters for status, timeframe, or relevance`);
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Discover and analyze ideas about "${params.search_topic}" in ${params.product_name || params.product_id || 'the relevant product/workspace'}:

**Search Topic**: ${params.search_topic}
${params.product_name ? `**Product/Workspace**: ${params.product_name}` : ''}
${params.product_id ? `**Product ID**: ${params.product_id}` : ''}
${params.analysis_focus ? `**Analysis Focus**: ${params.analysis_focus}` : ''}
${params.time_filter ? `**Time Filter**: ${params.time_filter}` : ''}
${params.include_status ? `**Status Filter**: ${params.include_status}` : ''}

${productContext}

**Search Process**:
${searchInstructions.join('\n')}

**Available Resources**:
- \`aha://products\` - List all products/workspaces
- \`aha://ideas/{product_id}?query={search_topic}\` - Search ideas in specific product
- \`aha://ideas?query={search_topic}\` - Search ideas globally
- \`aha://product/{product_id}\` - Get product details

Please provide:
1. **Search Strategy**: How to find the most relevant ideas for "${params.search_topic}"
2. **Resource Queries**: Specific MCP resource URLs to use for discovery
3. **Analysis Framework**: How to analyze and categorize the discovered ideas
4. **Key Insights**: What patterns or themes to look for in the results
5. **Prioritization Criteria**: How to rank and prioritize the discovered ideas
6. **Actionable Recommendations**: Next steps based on the discovered ideas
7. **Related Topics**: Suggested related topics to explore

Focus on providing specific, actionable search queries and analysis approaches.`
          }
        }]
      };
    }
  );

  // Resource Discovery with Sampling Primer
  server.registerPrompt(
    "aha_resource_discovery",
    {
      title: "Find the right Aha resource",
      description: "Get guidance on discovering and using Aha.io resources with terminology mapping and synonym support. Provides primers for common questions about workspaces, Product Areas, and workstreams.",
      argsSchema: {
        search_query: z.string().describe("What you're looking for (e.g., 'workspaces', 'Product Areas', 'how do I find features')")
      }
    },
    async (params: { search_query: string }) => {
      // Try to generate a sampling primer for this query
      const primer = getSamplingPrimer(params.search_query);

      if (primer) {
        // Return the primer as the prompt response
        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: `# Resource Discovery Guidance

${primer}

**Additional Help:**
- Use \`aha://resources\` to view the complete resource guide with all terminology mappings
- Check resource titles and descriptions - they include common synonyms
- Start with top-level resources (products, features, ideas, releases) and navigate down

**Common Terminology:**
- **Workspace** = **Product** (they're the same thing in Aha.io)
- **Product Area** = Subdivision within a product (not currently available as a resource)
- **Workstream** ≈ **Release** (releases organize features and epics)

What would you like to explore?`
            }
          }]
        };
      }

      // No specific primer, return general discovery guidance
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `# Aha.io Resource Discovery

I can help you find and use Aha.io resources. Here's how to get started:

**Quick Start Resources:**
- \`aha://resources\` - **Start here!** Complete guide with terminology and synonyms
- \`aha://products\` - List all products/workspaces
- \`aha://features\` - Search features globally
- \`aha://ideas\` - Search ideas and feedback
- \`aha://releases/{product_id}\` - List releases/workstreams for a product (get the id from \`aha://products\`)

**Common Questions:**

**Q: "How do I find workspaces?"**
A: Use \`aha://products\` - in Aha.io, products and workspaces are the same thing.

**Q: "Where are Product Areas?"**
A: Product Areas are not currently exposed as resources. Use \`aha://products\` to access products, which may include area information in the response.

**Q: "How do I find workstreams?"**
A: Use \`aha://releases/{product_id}\` - releases function as workstreams for organizing work. Get the product id from \`aha://products\` first.

**Resource Navigation Pattern:**
1. Start with top-level resources (products, features, ideas, releases)
2. Get IDs from the results
3. Navigate to nested resources using those IDs
4. Example: \`aha://products\` → get product ID → \`aha://releases/{product_id}\`

**Your Query:** "${params.search_query}"

What specific resources would you like to explore?`
          }
        }]
      };
    }
  );
  // ============================
  // ACCOUNT WORKFLOW PROMPTS
  //
  // These differ from the ones above: rather than templating a question, they tell the agent
  // which tools and resources to reach for and in what order. Nothing here fetches from Aha
  // itself, so a prompt cannot fail or stall on the network, and the agent is free to skip a
  // step that turns out not to apply.
  // ============================

  // 13. Idea Triage
  server.registerPrompt(
    "idea_triage",
    {
      title: "Triage an incoming idea",
      description: "Work out whether an incoming idea is a duplicate, how much demand sits behind it, and whether to promote, merge or decline it",
      argsSchema: {
        idea_id: completable(
          z.string().describe("Reference number of the idea to triage (e.g., PROJ-I-123)"),
          completeRecordReference("Idea")
        ),
        workspace: completable(
          z.string().optional().describe("Restrict the duplicate search to one workspace (reference prefix, e.g., PROJ)"),
          completeProduct("reference_prefix")
        ),
        decision_criteria: z.string().optional().describe("What matters for this call (e.g., 'strategic fit', 'support load', 'revenue at risk')")
      }
    },
    (params: { idea_id: string; workspace?: string; decision_criteria?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Triage idea ${params.idea_id}.
${params.decision_criteria ? `\n**What matters here**: ${params.decision_criteria}\n` : ''}
Gather before deciding:

1. **The idea itself** - read \`aha://idea/${params.idea_id}\`. Note its status, category and score.
2. **Demand behind it** - \`aha://idea/${params.idea_id}/votes\` and
   \`aha://idea/${params.idea_id}/endorsements\`. Endorsements name organisations, so they say
   *who* wants it, which vote counts alone do not.
3. **Existing discussion** - \`aha://comments/idea/${params.idea_id}\`.
4. **Possible duplicates** - \`aha_search\` for the idea's distinctive terms with
   \`recordTypes: ["Idea"]\`${params.workspace ? ` and \`workspaceId\` for ${params.workspace}` : ''}. Search the
   *concept*, not the title: a duplicate is rarely worded the same way. Try two or three
   phrasings before concluding there is none.

Then give me:

- **Duplicates**: any idea that is the same request in different words, each as a link. Say
  which should be the surviving record and why.
- **Demand**: how many votes and which organisations, not just a total.
- **Recommendation**: promote to a feature, merge into an existing record, or decline - one of
  the three, with the reasoning that decides it. Say plainly if the evidence does not support
  a confident call.
- **If promoting**: a suggested category and score, and which workspace it belongs in.

Do not change anything in Aha. This is a recommendation for a person to act on.`
        }
      }]
    })
  );

  // 14. Release Readiness
  server.registerPrompt(
    "release_readiness",
    {
      title: "Check release readiness",
      description: "Assess what is actually in a release, what is not finished, and what is at risk, from the release's own records",
      argsSchema: {
        release_id: z.string().describe("Reference number of the release (e.g., PROJ-R-1)"),
        cutoff_date: z.string().optional().describe("Date to judge readiness against, if not the release's own date"),
        concerns: z.string().optional().describe("Anything specific to look at (e.g., 'unassigned work', 'scope added late')")
      }
    },
    (params: { release_id: string; cutoff_date?: string; concerns?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Assess readiness of release ${params.release_id}.
${params.cutoff_date ? `\n**Judge against**: ${params.cutoff_date}\n` : ''}${params.concerns ? `**Look specifically at**: ${params.concerns}\n` : ''}
Read, in this order:

1. \`aha://release/${params.release_id}\` - the release's own dates and status.
2. \`aha://release/${params.release_id}/features\` - what is actually in it. This is the scope,
   whatever anyone believes the scope to be.
3. \`aha://release/${params.release_id}/epics\` - larger bodies of work that may span features.
4. \`aha://comments/release/${params.release_id}\` - decisions and slippage are often recorded
   here rather than in the fields.

Then report:

- **Scope**: how many features and epics, and their spread across workflow statuses.
- **Not done**: everything not in a terminal status, each as a link, with its status and due
  date. Order by risk to the release date, not alphabetically.
- **Unclear**: work with no due date, no assignee, or a status that has not moved - these are
  the items nobody is tracking.
- **Verdict**: ready, ready-with-caveats, or not ready, and the specific items that decide it.
  If the records are too incomplete to judge, say that rather than guessing.

Base every statement on a record you read. Do not infer progress from a feature's name.`
        }
      }]
    })
  );

  // 15. Feature Description Draft
  server.registerPrompt(
    "feature_description_draft",
    {
      title: "Draft a feature description",
      description: "Draft or sharpen a feature's description from its existing record, then offer to write it back to Aha",
      argsSchema: {
        feature_id: completable(
          z.string().describe("Reference number of the feature to describe (e.g., PROJ-123)"),
          completeRecordReference("Feature")
        ),
        audience: z.string().optional().describe("Who reads this description (e.g., 'engineering', 'field team', 'customers')"),
        key_points: z.string().optional().describe("Comma-separated points the description must make"),
        length: z.string().optional().describe("Rough target length (e.g., 'two paragraphs', 'a few sentences')")
      }
    },
    (params: { feature_id: string; audience?: string; key_points?: string; length?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Draft a description for feature ${params.feature_id}.
${params.audience ? `\n**Audience**: ${params.audience}` : ''}${params.key_points ? `\n**Must cover**: ${params.key_points}` : ''}${params.length ? `\n**Length**: ${params.length}` : ''}

First read \`aha://feature/${params.feature_id}\` - its current description, workflow status,
release and goals. Read \`aha://comments/requirement\` entries or the feature's own comments if
the description is thin; the intent is often in the discussion rather than the field.

Then:

1. **Show the current description** verbatim, so the change is reviewable. Say if there is none.
2. **Draft the replacement**. Lead with what the feature does for the user, not with how it is
   built. Do not invent capability the record does not support - if something needs deciding,
   list it as an open question instead of writing around it.
3. **Say what changed** and why, briefly.

Then stop and ask whether to write it back. Only on a clear yes, call \`aha_update_feature\`
with the new description. It overwrites the existing field, and the previous text is not
recoverable through this server, so the confirmation matters.`
        }
      }]
    })
  );

  // 16. Quarterly Roadmap Review
  server.registerPrompt(
    "quarterly_roadmap_review",
    {
      title: "Review a quarterly roadmap",
      description: "Compare what a workspace committed to for a quarter against what its records now show, and identify what needs a decision",
      argsSchema: {
        quarter: z.string().describe("Quarter under review (e.g., 'Q3 2026')"),
        workspace: completable(
          z.string().optional().describe("Workspace to review (reference prefix, e.g., PROJ). Omit to review across workspaces"),
          completeProduct("reference_prefix")
        ),
        goals_context: z.string().optional().describe("The goals or bets this quarter was meant to serve, if not recorded in Aha")
      }
    },
    (params: { quarter: string; workspace?: string; goals_context?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Review the ${params.quarter} roadmap${params.workspace ? ` for ${params.workspace}` : ' across workspaces'}.
${params.goals_context ? `\n**Intended goals**: ${params.goals_context}\n` : ''}
Gather:

1. ${params.workspace ? `\`aha://product/${params.workspace}\`` : '`aha://products` - decide which workspaces are in scope, and say which you picked'}.
2. **Releases in the quarter** - \`aha://releases/{product_id}\`, filtered to those whose dates
   fall in ${params.quarter}. Include parking-lot releases only if they carry committed work.
3. **What is in them** - \`aha://release/{release_id}/features\` per release.
4. **Strategy to compare against** - \`aha://goals\` and \`aha://initiatives\`, plus
   \`aha://goal/{goal_id}/epics\` where a goal has work hanging off it.

Then give me:

- **Committed vs current**: what the quarter holds now, and where a feature's status or date
  says it will not land. Link each one.
- **Unserved goals**: goals with no work pointing at them this quarter. This is usually the
  most useful part of the review, so do not skip it when the list is long.
- **Unattached work**: features carrying no goal or initiative. Some of that is legitimate
  maintenance; flag it rather than judging it.
- **Decisions needed**: the specific calls a person has to make, each naming the record it
  concerns.

Read only. Propose changes as a list for review; do not write to Aha.`
        }
      }]
    })
  );

  // 17. Customer Demand Rollup
  server.registerPrompt(
    "customer_demand_rollup",
    {
      title: "Roll up customer demand",
      description: "Find which customers and organisations have asked for something, across ideas and their comments",
      argsSchema: {
        topic: z.string().describe("What to look for - a capability, feature or theme (e.g., 'silence alerts by label')"),
        feature_id: completable(
          z.string().optional().describe("Feature this demand relates to, if there is one (e.g., PROJ-123)"),
          completeRecordReference("Feature")
        ),
        workspace: completable(
          z.string().optional().describe("Restrict to one workspace (reference prefix, e.g., PROJ)"),
          completeProduct("reference_prefix")
        )
      }
    },
    (params: { topic: string; feature_id?: string; workspace?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Roll up customer demand for: ${params.topic}
${params.feature_id ? `\n**Related feature**: ${params.feature_id} - read \`aha://feature/${params.feature_id}\` for the wording the team uses.\n` : ''}
Search widely before summarising. One query is not a rollup:

1. \`aha_search\` for the topic with \`recordTypes: ["Idea"]\`${params.workspace ? ` and \`workspaceId\` for ${params.workspace}` : ''}.
2. Search again with \`recordTypes: ["Comment"]\` - the clearest statements of need are often
   buried in comments on an unrelated record.
3. Vary the wording. Customers describe a need in their own terms, rarely the team's. Try the
   problem, the workaround, and the feature name; note which phrasings you tried.
4. For each idea worth counting: \`aha://idea/{id}/endorsements\` and \`aha://idea/{id}/votes\`.
   Endorsements carry the organisation, which is what makes this a customer rollup rather than
   a popularity count.

Then give me:

- **Who is asking**: organisations, each with the idea that evidences it as a link. Name the
  organisation, not just a count.
- **What they actually want**: where requests differ in substance, say so rather than merging
  them into one line. Two customers asking for the same feature for opposite reasons is the
  finding.
- **Weight of demand**: votes and endorsements, with the caveat that these measure portal
  activity, not revenue or account size.
- **Coverage**: which phrasings you searched and what you may have missed. A rollup that does
  not say where it stopped looking reads as complete when it is not.`
        }
      }]
    })
  );
}
