import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as services from "./services/index.js";
import { getSamplingPrimer } from "./sampling.js";

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
  server.prompt(
    "feature_analysis",
    "Analyze feature requirements, dependencies, and implementation strategies",
    {
      feature_name: z.string().describe("Name of the feature to analyze"),
      feature_description: z.string().optional().describe("Description of the feature"),
      product_context: z.string().optional().describe("Product context and goals"),
      existing_features: z.string().optional().describe("Comma-separated list of related existing features"),
      target_users: z.string().optional().describe("Target user segments"),
      feature_id: z.string().optional().describe("Existing feature ID from Aha.io for context (e.g., PROJ-123)")
    },
    async (params: { feature_name: string; feature_description?: string; product_context?: string; existing_features?: string; target_users?: string; feature_id?: string }) => {
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

${existingFeatureContext}

Please provide:
1. **Requirements Analysis**: Break down the feature into core requirements
2. **Dependencies**: Identify technical and feature dependencies
3. **Implementation Strategy**: Recommend approach and phases
4. **Risks & Challenges**: Highlight potential risks and mitigation strategies
5. **Success Metrics**: Define measurable success criteria
6. **Timeline Estimation**: Provide rough timeline estimates

Format your response with clear sections and actionable recommendations.`
          }
        }]
      };
    }
  );

  // 2. Product Roadmap Prompt
  server.prompt(
    "product_roadmap",
    "Generate product roadmap recommendations and strategic planning",
    {
      product_name: z.string().describe("Name of the product"),
      current_version: z.string().optional().describe("Current product version"),
      business_goals: z.string().describe("Business goals and objectives"),
      time_horizon: z.string().describe("Roadmap time horizon (quarter, half-year, year)"),
      key_features: z.string().optional().describe("Comma-separated list of key features to consider"),
      market_constraints: z.string().optional().describe("Market constraints and competitive landscape"),
      product_id: z.string().optional().describe("Existing product ID from Aha.io for context (e.g., PROJ)")
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
  server.prompt(
    "release_planning",
    "Create comprehensive release planning strategies and execution plans",
    {
      release_name: z.string().describe("Name of the release"),
      release_goals: z.string().describe("Primary goals for this release"),
      features_list: z.string().describe("Comma-separated list of features to include"),
      timeline: z.string().describe("Target timeline or deadline"),
      team_capacity: z.string().optional().describe("Team capacity and constraints"),
      dependencies: z.string().optional().describe("Comma-separated list of external dependencies")
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
  server.prompt(
    "competitor_analysis",
    "Analyze competitor features, positioning, and strategic implications",
    {
      competitor_name: z.string().describe("Name of the competitor"),
      product_category: z.string().describe("Product category or market segment"),
      focus_areas: z.string().optional().describe("Comma-separated list of specific areas to analyze"),
      our_product: z.string().optional().describe("Our product for comparison"),
      analysis_purpose: z.string().describe("Purpose of the analysis (e.g., feature gap, positioning, strategy)")
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
  server.prompt(
    "user_story_generation",
    "Generate comprehensive user stories from requirements and acceptance criteria",
    {
      feature_name: z.string().describe("Name of the feature"),
      user_personas: z.string().describe("Comma-separated list of target user personas"),
      requirements: z.string().describe("High-level requirements or epic description"),
      acceptance_criteria: z.string().optional().describe("Specific acceptance criteria"),
      constraints: z.string().optional().describe("Technical or business constraints")
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
  server.prompt(
    "sprint_planning",
    "Create sprint planning recommendations and capacity allocation",
    {
      sprint_duration: z.string().describe("Sprint duration (e.g., 2 weeks)"),
      team_capacity: z.string().describe("Team capacity and availability"),
      backlog_items: z.string().describe("Comma-separated list of prioritized backlog items"),
      sprint_goals: z.string().describe("Sprint goals and objectives"),
      previous_velocity: z.string().optional().describe("Previous sprint velocity data"),
      constraints: z.string().optional().describe("Sprint constraints or dependencies")
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
  server.prompt(
    "epic_breakdown",
    "Break down epics into manageable features and user stories",
    {
      epic_name: z.string().describe("Name of the epic"),
      epic_description: z.string().describe("Detailed epic description"),
      business_value: z.string().describe("Business value and objectives"),
      user_types: z.string().describe("Comma-separated list of user types affected"),
      constraints: z.string().optional().describe("Technical or business constraints"),
      timeline: z.string().optional().describe("Target timeline or deadline"),
      epic_id: z.string().optional().describe("Existing epic ID from Aha.io for context (e.g., PROJ-E-123)")
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
  server.prompt(
    "idea_prioritization",
    "Prioritize ideas based on strategic criteria and business value",
    {
      ideas_list: z.string().describe("Comma-separated list of ideas to prioritize"),
      business_goals: z.string().describe("Current business goals and strategy"),
      evaluation_criteria: z.string().optional().describe("Comma-separated list of evaluation criteria"),
      constraints: z.string().optional().describe("Resource or timeline constraints"),
      market_context: z.string().optional().describe("Market context and competitive landscape"),
      idea_ids: z.string().optional().describe("Comma-separated list of Aha.io idea IDs for context (e.g., PROJ-I-123,PROJ-I-456)")
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
  server.prompt(
    "stakeholder_communication",
    "Generate stakeholder updates and communication materials",
    {
      communication_type: z.string().describe("Type of communication (status_update, milestone_report, roadmap_presentation, issue_escalation)"),
      audience: z.string().describe("Target audience (executives, team, customers, etc.)"),
      project_status: z.string().describe("Current project or feature status"),
      key_achievements: z.string().optional().describe("Comma-separated list of key achievements to highlight"),
      challenges: z.string().optional().describe("Comma-separated list of current challenges or blockers"),
      next_steps: z.string().optional().describe("Planned next steps")
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
  server.prompt(
    "feature_specification",
    "Create detailed feature specifications and technical requirements",
    {
      feature_name: z.string().describe("Name of the feature"),
      user_stories: z.string().describe("Comma-separated list of related user stories"),
      functional_requirements: z.string().describe("Functional requirements"),
      non_functional_requirements: z.string().optional().describe("Non-functional requirements"),
      technical_constraints: z.string().optional().describe("Technical constraints"),
      integration_points: z.string().optional().describe("Comma-separated list of integration points with other systems")
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
  server.prompt(
    "risk_assessment",
    "Assess project and feature risks with mitigation strategies",
    {
      project_name: z.string().describe("Name of the project or feature"),
      project_scope: z.string().describe("Project scope and objectives"),
      timeline: z.string().describe("Project timeline and key milestones"),
      team_composition: z.string().optional().describe("Team composition and skills"),
      dependencies: z.string().optional().describe("Comma-separated list of external dependencies"),
      known_risks: z.string().optional().describe("Comma-separated list of already identified risks")
    },
    (params: { project_name: string; project_scope: string; timeline: string; team_composition?: string; dependencies?: string; known_risks?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Assess risks for:

**Project**: ${params.project_name}
**Scope**: ${params.project_scope}
**Timeline**: ${params.timeline}
${params.team_composition ? `**Team**: ${params.team_composition}` : ''}
${params.dependencies ? `**Dependencies**: ${params.dependencies}` : ''}
${params.known_risks ? `**Known Risks**: ${params.known_risks}` : ''}

Please provide:
1. **Risk Identification**: Comprehensive list of potential risks
2. **Risk Categorization**: Categorize risks by type (technical, resource, market, etc.)
3. **Impact Assessment**: Assess potential impact of each risk
4. **Probability Analysis**: Estimate likelihood of each risk occurring
5. **Risk Prioritization**: Prioritize risks by impact and probability
6. **Mitigation Strategies**: Specific mitigation and contingency plans
7. **Monitoring Plan**: How to monitor and track risk indicators
8. **Escalation Procedures**: When and how to escalate risks

Use a structured risk assessment framework with clear action items.`
        }
      }]
    })
  );

  // 12. Success Metrics Prompt
  server.prompt(
    "success_metrics",
    "Define success metrics and KPIs for features and initiatives",
    {
      initiative_name: z.string().describe("Name of the initiative or feature"),
      business_objectives: z.string().describe("Business objectives and goals"),
      user_impact: z.string().describe("Expected user impact and benefits"),
      success_timeframe: z.string().describe("Timeframe for measuring success"),
      current_baseline: z.string().optional().describe("Current baseline metrics"),
      measurement_capabilities: z.string().optional().describe("Available measurement and analytics capabilities")
    },
    (params: { initiative_name: string; business_objectives: string; user_impact: string; success_timeframe: string; current_baseline?: string; measurement_capabilities?: string }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Define success metrics for:

**Initiative**: ${params.initiative_name}
**Business Objectives**: ${params.business_objectives}
**User Impact**: ${params.user_impact}
**Success Timeframe**: ${params.success_timeframe}
${params.current_baseline ? `**Current Baseline**: ${params.current_baseline}` : ''}
${params.measurement_capabilities ? `**Measurement Capabilities**: ${params.measurement_capabilities}` : ''}

Please provide:
1. **Primary Success Metrics**: Key metrics that indicate success
2. **Secondary Metrics**: Supporting metrics and leading indicators
3. **User Behavior Metrics**: User engagement and adoption metrics
4. **Business Impact Metrics**: Revenue, efficiency, and business value metrics
5. **Technical Performance Metrics**: System performance and reliability metrics
6. **Measurement Framework**: How and when to measure each metric
7. **Target Values**: Specific target values and success thresholds
8. **Reporting Strategy**: How to report and communicate progress

Focus on actionable, measurable metrics that align with business objectives.`
        }
      }]
    })
  );

  // 13. Product Idea Discovery Prompt
  server.prompt(
    "product_idea_discovery",
    "Discover and analyze ideas within products/workspaces based on topics, themes, or keywords",
    {
      search_topic: z.string().describe("The topic, theme, or keyword to search for (e.g., 'Node.js', 'mobile', 'API')"),
      product_name: z.string().optional().describe("Name of the product/workspace to search in (e.g., 'VoC', 'Platform')"),
      product_id: z.string().optional().describe("Specific product ID to search in (e.g., 'VOC-1')"),
      analysis_focus: z.string().optional().describe("What aspect to focus on (e.g., 'customer pain points', 'feature gaps', 'enhancement opportunities')"),
      time_filter: z.string().optional().describe("Time filter for ideas (e.g., 'last 6 months', 'recent', 'all time')"),
      include_status: z.string().optional().describe("Comma-separated list of idea statuses to include (e.g., 'new,under review,planned')")
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
  server.prompt(
    "aha_resource_discovery",
    {
      name: "aha_resource_discovery",
      description: "Get guidance on discovering and using Aha.io resources with terminology mapping and synonym support. Provides primers for common questions about workspaces, Product Areas, and workstreams.",
      arguments: [
        {
          name: "search_query",
          description: "What you're looking for (e.g., 'workspaces', 'Product Areas', 'how do I find features')",
          required: true
        }
      ]
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
- \`aha://releases\` - List releases/workstreams

**Common Questions:**

**Q: "How do I find workspaces?"**
A: Use \`aha://products\` - in Aha.io, products and workspaces are the same thing.

**Q: "Where are Product Areas?"**
A: Product Areas are not currently exposed as resources. Use \`aha://products\` to access products, which may include area information in the response.

**Q: "How do I find workstreams?"**
A: Use \`aha://releases\` - releases function as workstreams for organizing work.

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
}