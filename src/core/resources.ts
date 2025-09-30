import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as services from "./services/index.js";

/**
 * Register all resources with the MCP server
 * @param server The MCP server instance
 */
export function registerResources(server: McpServer) {
  // Aha idea resource
  server.resource(
    "aha_idea",
    "aha://idea/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid idea ID: ID is missing from URI');
      }
      try {
        const idea = await services.AhaService.getIdea(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(idea, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving idea ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha feature resource
  server.resource(
    "aha_feature",
    "aha://feature/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid feature ID: ID is missing from URI');
      }
      try {
        const feature = await services.AhaService.getFeature(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(feature, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving feature ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha user resource
  server.resource(
    "aha_user",
    "aha://user/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid user ID: ID is missing from URI');
      }
      try {
        const user = await services.AhaService.getUser(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(user, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving user ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha epic resource
  server.resource(
    "aha_epic",
    "aha://epic/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid epic ID: ID is missing from URI');
      }
      try {
        const epic = await services.AhaService.getEpic(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epic, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epic ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha features list resource
  server.resource(
    "aha_features",
    "aha://features",
    async (uri: URL) => {
      try {
        const params = new URLSearchParams(uri.search);
        const query = params.get('query') || undefined;
        const updatedSince = params.get('updatedSince') || undefined;
        const tag = params.get('tag') || undefined;
        const assignedToUser = params.get('assignedToUser') || undefined;

        const features = await services.AhaService.listFeatures(
          query,
          updatedSince,
          tag,
          assignedToUser
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(features, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving features list:`, error);
        throw error;
      }
    }
  );

  // Aha users list resource
  server.resource(
    "aha_users",
    "aha://users",
    async (uri: URL) => {
      try {
        const users = await services.AhaService.listUsers();

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(users, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving users list:`, error);
        throw error;
      }
    }
  );

  // Aha epics list resource
  server.resource(
    "aha_epics",
    "aha://epics/{product_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const productId = pathParts[pathParts.length - 1];
      
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      
      try {
        const epics = await services.AhaService.listEpics(productId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epics, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics list for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha product resource
  server.resource(
    "aha_product",
    "aha://product/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid product ID: ID is missing from URI');
      }
      try {
        const product = await services.AhaService.getProduct(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(product, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving product ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha products list resource
  server.resource(
    "aha_products",
    "aha://products",
    async (uri: URL) => {
      try {
        // Extract query parameters for filtering
        const updatedSince = uri.searchParams.get('updatedSince') || undefined;

        const products = await services.AhaService.listProducts(updatedSince);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(products, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving products list:`, error);
        throw error;
      }
    }
  );

  // Aha initiative resource
  server.resource(
    "aha_initiative",
    "aha://initiative/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid initiative ID: ID is missing from URI');
      }
      try {
        const initiative = await services.AhaService.getInitiative(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(initiative, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving initiative ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha initiatives list resource
  server.resource(
    "aha_initiatives",
    "aha://initiatives",
    async (uri: URL) => {
      try {
        // Extract query parameters for advanced filtering
        const query = uri.searchParams.get('query') || undefined;
        const updatedSince = uri.searchParams.get('updatedSince') || undefined;
        const assignedToUser = uri.searchParams.get('assignedToUser') || undefined;
        const onlyActive = uri.searchParams.get('onlyActive') === 'true' ? true : 
                          uri.searchParams.get('onlyActive') === 'false' ? false : undefined;

        const initiatives = await services.AhaService.listInitiatives(
          query,
          updatedSince,
          assignedToUser,
          onlyActive
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(initiatives, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving initiatives list:`, error);
        throw error;
      }
    }
  );

  // Aha ideas by product resource
  server.resource(
    "aha_ideas_by_product",
    "aha://ideas/{product_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const productId = pathParts[pathParts.length - 1];
      
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      
      try {
        // Extract query parameters for advanced filtering
        const query = uri.searchParams.get('query') || undefined;
        const spam = uri.searchParams.get('spam') === 'true' ? true : 
                    uri.searchParams.get('spam') === 'false' ? false : undefined;
        const workflowStatus = uri.searchParams.get('workflowStatus') || undefined;
        const sort = uri.searchParams.get('sort') || undefined;
        const createdBefore = uri.searchParams.get('createdBefore') || undefined;
        const createdSince = uri.searchParams.get('createdSince') || undefined;
        const updatedSince = uri.searchParams.get('updatedSince') || undefined;
        const tag = uri.searchParams.get('tag') || undefined;
        const userId = uri.searchParams.get('userId') || undefined;
        const ideaUserId = uri.searchParams.get('ideaUserId') || undefined;

        const ideas = await services.AhaService.listIdeasByProduct(
          productId,
          query,
          spam,
          workflowStatus,
          sort,
          createdBefore,
          createdSince,
          updatedSince,
          tag,
          userId,
          ideaUserId
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(ideas, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving ideas list for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha epic comments resource
  server.resource(
    "aha_epic_comments",
    "aha://comments/epic/{epic_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const epicId = pathParts[pathParts.length - 1];
      
      if (!epicId) {
        throw new Error('Invalid epic ID: Epic ID is missing from URI');
      }
      
      try {
        const comments = await services.AhaService.getEpicComments(epicId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for epic ${epicId}:`, error);
        throw error;
      }
    }
  );

  // Aha idea comments resource
  server.resource(
    "aha_idea_comments",
    "aha://comments/idea/{idea_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = pathParts[pathParts.length - 1];
      
      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }
      
      try {
        const comments = await services.AhaService.getIdeaComments(ideaId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for idea ${ideaId}:`, error);
        throw error;
      }
    }
  );

  // Aha initiative comments resource
  server.resource(
    "aha_initiative_comments",
    "aha://comments/initiative/{initiative_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const initiativeId = pathParts[pathParts.length - 1];
      
      if (!initiativeId) {
        throw new Error('Invalid initiative ID: Initiative ID is missing from URI');
      }
      
      try {
        const comments = await services.AhaService.getInitiativeComments(initiativeId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for initiative ${initiativeId}:`, error);
        throw error;
      }
    }
  );

  // Aha product comments resource
  server.resource(
    "aha_product_comments",
    "aha://comments/product/{product_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const productId = pathParts[pathParts.length - 1];
      
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      
      try {
        const comments = await services.AhaService.getProductComments(productId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha goal comments resource
  server.resource(
    "aha_goal_comments",
    "aha://comments/goal/{goal_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const goalId = pathParts[pathParts.length - 1];
      
      if (!goalId) {
        throw new Error('Invalid goal ID: Goal ID is missing from URI');
      }
      
      try {
        const comments = await services.AhaService.getGoalComments(goalId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for goal ${goalId}:`, error);
        throw error;
      }
    }
  );

  // Aha release comments resource
  server.resource(
    "aha_release_comments",
    "aha://comments/release/{release_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const releaseId = pathParts[pathParts.length - 1];
      
      if (!releaseId) {
        throw new Error('Invalid release ID: Release ID is missing from URI');
      }
      
      try {
        const comments = await services.AhaService.getReleaseComments(releaseId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for release ${releaseId}:`, error);
        throw error;
      }
    }
  );

  // Aha release phase comments resource
  server.resource(
    "aha_release_phase_comments",
    "aha://comments/release-phase/{release_phase_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const releasePhaseId = pathParts[pathParts.length - 1];
      
      if (!releasePhaseId) {
        throw new Error('Invalid release phase ID: Release phase ID is missing from URI');
      }
      
      try {
        const comments = await services.AhaService.getReleasePhaseComments(releasePhaseId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for release phase ${releasePhaseId}:`, error);
        throw error;
      }
    }
  );

  // Aha requirement comments resource
  server.resource(
    "aha_requirement_comments",
    "aha://comments/requirement/{requirement_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const requirementId = pathParts[pathParts.length - 1];
      
      if (!requirementId) {
        throw new Error('Invalid requirement ID: Requirement ID is missing from URI');
      }
      
      try {
        const comments = await services.AhaService.getRequirementComments(requirementId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for requirement ${requirementId}:`, error);
        throw error;
      }
    }
  );

  // Aha todo comments resource
  server.resource(
    "aha_todo_comments",
    "aha://comments/todo/{todo_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const todoId = pathParts[pathParts.length - 1];
      
      if (!todoId) {
        throw new Error('Invalid todo ID: Todo ID is missing from URI');
      }
      
      try {
        const comments = await services.AhaService.getTodoComments(todoId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for todo ${todoId}:`, error);
        throw error;
      }
    }
  );

  // Aha goal resource
  server.resource(
    "aha_goal",
    "aha://goal/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid goal ID: ID is missing from URI');
      }
      try {
        const goal = await services.AhaService.getGoal(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(goal, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving goal ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha goals list resource
  server.resource(
    "aha_goals",
    "aha://goals",
    async (uri: URL) => {
      try {
        const goals = await services.AhaService.listGoals();

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(goals, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving goals list:`, error);
        throw error;
      }
    }
  );

  // Aha goal epics resource
  server.resource(
    "aha_goal_epics",
    "aha://goal/{goal_id}/epics",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const goalId = pathParts[pathParts.length - 2]; // goal_id is before /epics
      
      if (!goalId) {
        throw new Error('Invalid goal ID: Goal ID is missing from URI');
      }
      
      try {
        const epics = await services.AhaService.getGoalEpics(goalId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epics, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics for goal ${goalId}:`, error);
        throw error;
      }
    }
  );

  // Aha release resource
  server.resource(
    "aha_release",
    "aha://release/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid release ID: ID is missing from URI');
      }
      try {
        const release = await services.AhaService.getRelease(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(release, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving release ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha releases list resource
  server.resource(
    "aha_releases",
    "aha://releases",
    async (uri: URL) => {
      try {
        const releases = await services.AhaService.listReleases();

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(releases, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving releases list:`, error);
        throw error;
      }
    }
  );

  // Aha release features resource
  server.resource(
    "aha_release_features",
    "aha://release/{release_id}/features",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const releaseId = pathParts[pathParts.length - 2]; // release_id is before /features
      
      if (!releaseId) {
        throw new Error('Invalid release ID: Release ID is missing from URI');
      }
      
      try {
        const features = await services.AhaService.getReleaseFeatures(releaseId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(features, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving features for release ${releaseId}:`, error);
        throw error;
      }
    }
  );

  // Aha release epics resource
  server.resource(
    "aha_release_epics",
    "aha://release/{release_id}/epics",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const releaseId = pathParts[pathParts.length - 2]; // release_id is before /epics
      
      if (!releaseId) {
        throw new Error('Invalid release ID: Release ID is missing from URI');
      }
      
      try {
        const epics = await services.AhaService.getReleaseEpics(releaseId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epics, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics for release ${releaseId}:`, error);
        throw error;
      }
    }
  );

  // Aha release phase resource
  server.resource(
    "aha_release_phase",
    "aha://release-phase/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid release phase ID: ID is missing from URI');
      }
      try {
        const releasePhase = await services.AhaService.getReleasePhase(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(releasePhase, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving release phase ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha release phases list resource
  server.resource(
    "aha_release_phases",
    "aha://release-phases",
    async (uri: URL) => {
      try {
        const releasePhases = await services.AhaService.listReleasePhases();

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(releasePhases, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving release phases list:`, error);
        throw error;
      }
    }
  );

  // Aha requirement resource
  server.resource(
    "aha_requirement",
    "aha://requirement/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid requirement ID: ID is missing from URI');
      }
      try {
        const requirement = await services.AhaService.getRequirement(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(requirement, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving requirement ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha competitor resource
  server.resource(
    "aha_competitor",
    "aha://competitor/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid competitor ID: ID is missing from URI');
      }
      try {
        const competitor = await services.AhaService.getCompetitor(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(competitor, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving competitor ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha todo resource
  server.resource(
    "aha_todo",
    "aha://todo/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid todo ID: ID is missing from URI');
      }
      try {
        const todo = await services.AhaService.getTodo(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(todo, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving todo ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha competitors list resource
  server.resource(
    "aha_competitors",
    "aha://competitors/{product_id}",
    async (uri: URL) => {
      const productId = uri.pathname.split('/').pop();
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      try {
        const competitors = await services.AhaService.listCompetitors(productId);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(competitors, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving competitors for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha strategic model resource
  server.resource(
    "aha_strategic_model",
    "aha://strategic-model/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid strategic model ID: ID is missing from URI');
      }
      try {
        const strategicModel = await services.AhaService.getStrategicModel(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(strategicModel, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving strategic model ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha strategic models list resource
  server.resource(
    "aha_strategic_models",
    "aha://strategic-models",
    async (uri: URL) => {
      try {
        const strategicModels = await services.AhaService.listStrategicModels();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(strategicModels, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving strategic models list:', error);
        throw error;
      }
    }
  );

  // Aha todos list resource
  server.resource(
    "aha_todos",
    "aha://todos",
    async (uri: URL) => {
      try {
        const todos = await services.AhaService.listTodos();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(todos, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving todos list:', error);
        throw error;
      }
    }
  );

  // Aha idea organization resource
  server.resource(
    "aha_idea_organization",
    "aha://idea-organization/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid idea organization ID: ID is missing from URI');
      }
      try {
        const ideaOrganization = await services.AhaService.getIdeaOrganization(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(ideaOrganization, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving idea organization ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha idea organizations list resource
  server.resource(
    "aha_idea_organizations",
    "aha://idea-organizations",
    async (uri: URL) => {
      try {
        const ideaOrganizations = await services.AhaService.listIdeaOrganizations();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(ideaOrganizations, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving idea organizations list:', error);
        throw error;
      }
    }
  );

  // Aha me/current user profile resource
  server.resource(
    "aha_me_profile",
    "aha://me/profile",
    async (uri: URL) => {
      try {
        const profile = await services.AhaService.getMe();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(profile, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving user profile:', error);
        throw error;
      }
    }
  );

  // Aha me/current user assigned records resource
  server.resource(
    "aha_me_assigned_records",
    "aha://me/assigned-records",
    async (uri: URL) => {
      try {
        const assignedRecords = await services.AhaService.getAssignedRecords();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(assignedRecords, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving assigned records:', error);
        throw error;
      }
    }
  );

  // Aha me/current user pending tasks resource
  server.resource(
    "aha_me_pending_tasks",
    "aha://me/pending-tasks",
    async (uri: URL) => {
      try {
        const pendingTasks = await services.AhaService.getPendingTasks();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(pendingTasks, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving pending tasks:', error);
        throw error;
      }
    }
  );

  // Aha idea endorsements resource
  server.resource(
    "aha_idea_endorsements",
    "aha://idea/{id}/endorsements",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = pathParts[pathParts.length - 2]; // idea_id is before /endorsements
      
      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }
      
      try {
        const endorsements = await services.AhaService.getIdeaEndorsements(ideaId);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(endorsements, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving endorsements for idea ${ideaId}:`, error);
        throw error;
      }
    }
  );

  // Aha idea votes resource
  server.resource(
    "aha_idea_votes",
    "aha://idea/{id}/votes",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = pathParts[pathParts.length - 2]; // idea_id is before /votes
      
      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }
      
      try {
        const votes = await services.AhaService.getIdeaVotes(ideaId);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(votes, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving votes for idea ${ideaId}:`, error);
        throw error;
      }
    }
  );

  // Aha idea watchers resource
  server.resource(
    "aha_idea_watchers",
    "aha://idea/{id}/watchers",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = pathParts[pathParts.length - 2]; // idea_id is before /watchers
      
      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }
      
      try {
        const watchers = await services.AhaService.getIdeaWatchers(ideaId);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(watchers, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving watchers for idea ${ideaId}:`, error);
        throw error;
      }
    }
  );

  // Aha global ideas list resource
  server.resource(
    "aha_ideas",
    "aha://ideas",
    async (uri: URL) => {
      try {
        // Extract query parameters for advanced filtering
        const query = uri.searchParams.get('query') || undefined;
        const updatedSince = uri.searchParams.get('updatedSince') || undefined;
        const assignedToUser = uri.searchParams.get('assignedToUser') || undefined;
        const status = uri.searchParams.get('status') || undefined;
        const category = uri.searchParams.get('category') || undefined;
        
        // Include custom_fields in the fields parameter to get custom fields in response
        const fields = 'custom_fields';

        const ideas = await services.AhaService.listIdeas(
          query,
          updatedSince,
          assignedToUser,
          status,
          category,
          fields
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(ideas, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving global ideas list:', error);
        throw error;
      }
    }
  );

  // Aha product releases resource
  server.resource(
    "aha_product_releases",
    "aha://releases/{product_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const productId = pathParts[pathParts.length - 1];
      
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      
      try {
        // Extract query parameters for advanced filtering
        const query = uri.searchParams.get('query') || undefined;
        const updatedSince = uri.searchParams.get('updatedSince') || undefined;
        const status = uri.searchParams.get('status') || undefined;
        const parkingLot = uri.searchParams.get('parkingLot') === 'true' ? true : 
                          uri.searchParams.get('parkingLot') === 'false' ? false : undefined;

        const releases = await services.AhaService.listReleasesByProduct(
          productId,
          query,
          updatedSince,
          status,
          parkingLot
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(releases, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving releases list for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha initiative epics resource
  server.resource(
    "aha_initiative_epics",
    "aha://initiative/{initiative_id}/epics",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const initiativeId = pathParts[pathParts.length - 2]; // initiative_id is before /epics
      
      if (!initiativeId) {
        throw new Error('Invalid initiative ID: Initiative ID is missing from URI');
      }
      
      try {
        const epics = await services.AhaService.getInitiativeEpics(initiativeId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epics, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics for initiative ${initiativeId}:`, error);
        throw error;
      }
    }
  );
}
