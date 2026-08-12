import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const serverJson = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');

const npmPackage = serverJson.packages.find((p: { registryType: string }) => p.registryType === 'npm');
const ociPackage = serverJson.packages.find((p: { registryType: string }) => p.registryType === 'oci');

/**
 * The MCP Registry verifies that we own the artifacts server.json points at, and it does so
 * per package type by looking for the server name inside the published artifact: `mcpName`
 * in package.json for npm, an `io.modelcontextprotocol.server.name` label for the ghcr
 * image. A mismatch is not a degraded listing, it is a rejected publish - and it only shows
 * up during a release, after npm and ghcr have already been written to.
 */
describe('server.json', () => {
  it('claims the GitHub namespace that github-oidc login can actually authenticate', () => {
    // With GitHub auth the registry only grants `io.github.<owner>/`; anything else is
    // refused with "You do not have permission to publish this server".
    expect(serverJson.name).toBe('io.github.cedricziel/aha-mcp');
  });

  it('matches the npm ownership marker in package.json', () => {
    expect(packageJson.mcpName).toBe(serverJson.name);
  });

  it('matches the OCI ownership marker in the Dockerfile', () => {
    expect(dockerfile).toContain(`LABEL io.modelcontextprotocol.server.name="${serverJson.name}"`);
  });

  it('is bumped in step with the package version', () => {
    // release-please owns both fields via extra-files; this fails if one entry is dropped.
    expect(serverJson.version).toBe(packageJson.version);
    expect(npmPackage.version).toBe(packageJson.version);
  });

  it('points the npm entry at the package this repo publishes', () => {
    expect(npmPackage.identifier).toBe(packageJson.name);
  });

  /**
   * The ghcr tag is not asserted against the current version: it lives inside a string, so
   * release-please's json updater cannot bump it, and the release workflow rewrites it from
   * the tag instead. Only the shape is pinned here, so a typo in the image name still fails
   * before a release rather than during one.
   */
  it('points the oci entry at a version-tagged ghcr image', () => {
    expect(ociPackage.identifier).toMatch(/^ghcr\.io\/cedricziel\/aha-mcp:\d+\.\d+\.\d+$/);
  });

  it('declares the credentials the server cannot start without', () => {
    for (const pkg of [npmPackage, ociPackage]) {
      const names = pkg.environmentVariables.map((v: { name: string }) => v.name);
      expect(names).toContain('AHA_COMPANY');
      expect(names).toContain('AHA_TOKEN');

      const token = pkg.environmentVariables.find((v: { name: string }) => v.name === 'AHA_TOKEN');
      expect(token.isSecret).toBe(true);
    }
  });

  it('keeps the description inside the 100-character limit the schema sets', () => {
    expect(serverJson.description.length).toBeLessThanOrEqual(100);
  });
});
