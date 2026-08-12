import { describe, it, expect } from 'bun:test';
import { buildServerInstructions } from '../src/core/instructions.js';

describe('buildServerInstructions', () => {
  it('names the configured account so the client knows which Aha it is talking to', () => {
    expect(buildServerInstructions('acme')).toContain('https://acme.aha.io');
  });

  it('stays generic when no company is configured', () => {
    const instructions = buildServerInstructions(null);

    expect(instructions).not.toContain('aha.io/');
    expect(instructions).toContain('configured against');
  });

  it('treats an empty subdomain as unconfigured rather than emitting https://.aha.io', () => {
    expect(buildServerInstructions('')).not.toContain('https://.aha.io');
  });

  it('asks for records to be linked by their url, labelled with the reference number', () => {
    const instructions = buildServerInstructions('acme');

    expect(instructions).toMatch(/markdown link/i);
    expect(instructions).toContain('reference_num');
    // `resource` is the API endpoint; offering it as a link sends the user to JSON.
    expect(instructions).toMatch(/never offer it as the link/i);
  });
});
