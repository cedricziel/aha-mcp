import { afterEach, describe, expect, it } from 'bun:test';
import { AhaService } from '../src/core/services/aha-service.js';

/**
 * Regression coverage for the wire contract in Aha's comment APIs. Formatted text belongs
 * in `body` as raw HTML; neither the MCP service nor the generated SDK should convert it to
 * Markdown, escape it a second time, or rename it to an undocumented `html_body` field.
 */
describe('AhaService comment writes', () => {
  const originalCommentsApi = (AhaService as any).commentsApi;
  const originalIdeaCommentsApi = (AhaService as any).ideaCommentsApi;

  afterEach(() => {
    (AhaService as any).commentsApi = originalCommentsApi;
    (AhaService as any).ideaCommentsApi = originalIdeaCommentsApi;
  });

  it('sends raw HTML as comment.body when updating an internal comment', async () => {
    const html = '<p>Ship <strong>today</strong> &amp; notify support.</p>';
    let request: unknown;
    (AhaService as any).commentsApi = {
      commentsByIdPut: async (value: unknown) => {
        request = value;
        return { data: { comment: { id: '781701978', body: html } } };
      }
    };

    const result = await AhaService.updateComment('781701978', html);

    expect(request).toEqual({
      id: '781701978',
      commentsPostRequest: { comment: { body: html } }
    });
    expect(result.body).toBe(html);
  });

  it('sends raw HTML as comment.body when creating an internal comment', async () => {
    const html = '<ul><li>First</li><li>Second</li></ul>';
    let request: unknown;
    (AhaService as any).commentsApi = {
      featuresByFeatureCommentsPost: async (value: unknown) => {
        request = value;
        return { data: { comment: { id: '12', body: html } } };
      }
    };

    await AhaService.createFeatureComment('PRJ1-123', html);

    expect(request).toEqual({
      featureId: 'PRJ1-123',
      commentsPostRequest: { comment: { body: html } }
    });
  });

  it('sends raw HTML as idea_comment.body for an ideas-portal comment', async () => {
    const html = '<p>Thanks — this is now <em>planned</em>.</p>';
    let request: any;
    (AhaService as any).ideaCommentsApi = {
      ideasByIdeaIdeaCommentsPost: async (value: unknown) => {
        request = value;
        return { data: { idea_comment: { id: '34', body: html } } };
      }
    };

    await AhaService.createIdeaPortalComment('PRJ1-I-7', html, 'public');

    expect(request).toEqual({
      ideaId: 'PRJ1-I-7',
      ideacommentsPostRequest: {
        idea_comment: { body: html, visibility: 'public' }
      }
    });
    expect(request.ideacommentsPostRequest.idea_comment.html_body).toBeUndefined();
  });

  it('uses the root endpoint for internal deletes and the idea-scoped endpoint for portal deletes', async () => {
    let internalRequest: unknown;
    let portalRequest: unknown;
    (AhaService as any).commentsApi = {
      commentsByIdDelete: async (value: unknown) => {
        internalRequest = value;
      }
    };
    (AhaService as any).ideaCommentsApi = {
      ideasByIdeaIdeaCommentsByIdDelete: async (value: unknown) => {
        portalRequest = value;
      }
    };

    await AhaService.deleteComment('55160124');
    await AhaService.deleteIdeaPortalComment('PRJ1-I-7', '622085811');

    expect(internalRequest).toEqual({ id: '55160124' });
    expect(portalRequest).toEqual({ ideaId: 'PRJ1-I-7', id: '622085811' });
  });
});
