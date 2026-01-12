import { describe, it, expect } from 'bun:test';
import {
  detectTerminology,
  analyzeAndPrime,
  formatPrimer,
  generateProductWorkspacePrimer,
  generateProductAreaPrimer,
  generateWorkstreamPrimer,
  generateDiscoveryPrimer
} from '../src/core/sampling/resource-primer';
import { getSamplingPrimer } from '../src/core/sampling';
import type { ResourcePrimer } from '../src/core/sampling/types';

describe('Sampling - Terminology Detection', () => {
  it('should detect workspace terminology', () => {
    const result = detectTerminology('show me all workspaces');
    expect(result.synonyms).toContain('workspace');
    expect(result.canonical).toContain('product');
  });

  it('should detect Product Area terminology (case-insensitive)', () => {
    const result1 = detectTerminology('where are Product Areas');
    expect(result1.synonyms).toContain('Product Area');
    expect(result1.canonical).toContain('product_area');

    const result2 = detectTerminology('show me product areas');
    expect(result2.synonyms).toContain('Product Area');
    expect(result2.canonical).toContain('product_area');
  });

  it('should detect workstream terminology', () => {
    const result = detectTerminology('list all workstreams');
    expect(result.synonyms).toContain('workstream');
    expect(result.canonical).toContain('release');
  });

  it('should handle queries with multiple terminology types', () => {
    const result = detectTerminology('show workspaces and workstreams');
    expect(result.synonyms).toContain('workspace');
    expect(result.synonyms).toContain('workstream');
    expect(result.canonical).toContain('product');
    expect(result.canonical).toContain('release');
  });

  it('should return empty arrays for queries without special terminology', () => {
    const result = detectTerminology('list all features');
    expect(result.synonyms.length).toBe(0);
    expect(result.canonical.length).toBe(0);
  });
});

describe('Sampling - Primer Generation', () => {
  describe('Product/Workspace Primer', () => {
    it('should generate primer for workspace queries', () => {
      const primer = generateProductWorkspacePrimer('show me workspaces');
      expect(primer.message).toContain('products and workspaces are synonymous');
      expect(primer.suggestedResources.length).toBeGreaterThan(0);
      expect(primer.exampleUris.length).toBeGreaterThan(0);
      expect(primer.workflow).toBeDefined();
      expect(primer.workflow!.length).toBeGreaterThan(0);
    });

    it('should include correct resource URIs', () => {
      const primer = generateProductWorkspacePrimer('workspaces');
      expect(primer.suggestedResources.some(r => r.includes('aha://products'))).toBe(true);
      expect(primer.suggestedResources.some(r => r.includes('aha://product/{id}'))).toBe(true);
    });
  });

  describe('Product Area Primer', () => {
    it('should generate primer explaining Product Areas are not available', () => {
      const primer = generateProductAreaPrimer('show Product Areas');
      expect(primer.message).toContain('not exposed as resources');
      expect(primer.suggestedResources.length).toBeGreaterThan(0);
    });

    it('should suggest alternative resources', () => {
      const primer = generateProductAreaPrimer('Product Areas');
      expect(primer.suggestedResources.some(r => r.includes('aha://products'))).toBe(true);
    });
  });

  describe('Workstream Primer', () => {
    it('should generate primer for workstream queries', () => {
      const primer = generateWorkstreamPrimer('show workstreams');
      expect(primer.message).toContain('releases can function as workstreams');
      expect(primer.suggestedResources.length).toBeGreaterThan(0);
    });

    it('should include release resources', () => {
      const primer = generateWorkstreamPrimer('workstreams');
      expect(primer.suggestedResources.some(r => r.includes('aha://releases'))).toBe(true);
      expect(primer.suggestedResources.some(r => r.includes('aha://release/{id}'))).toBe(true);
    });
  });

  describe('Discovery Primer', () => {
    it('should generate general discovery primer', () => {
      const primer = generateDiscoveryPrimer();
      expect(primer.message).toContain('resource guide');
      expect(primer.suggestedResources.length).toBeGreaterThan(0);
    });

    it('should include aha://resources in suggestions', () => {
      const primer = generateDiscoveryPrimer();
      expect(primer.suggestedResources.some(r => r.includes('aha://resources'))).toBe(true);
    });
  });
});

describe('Sampling - Query Analysis', () => {
  it('should return workspace primer for workspace queries', () => {
    const primer = analyzeAndPrime('show me all workspaces');
    expect(primer).not.toBeNull();
    expect(primer!.message).toContain('workspace');
  });

  it('should return Product Area primer for Product Area queries', () => {
    const primer = analyzeAndPrime('where are Product Areas');
    expect(primer).not.toBeNull();
    expect(primer!.message).toContain('Product Area');
  });

  it('should return workstream primer for workstream queries', () => {
    const primer = analyzeAndPrime('list workstreams');
    expect(primer).not.toBeNull();
    expect(primer!.message).toContain('workstream');
  });

  it('should return discovery primer for general discovery queries', () => {
    const discoveryQueries = [
      'how do i find features',
      'where can i see resources',
      'how to access data',
      'show me available resources',
      'what resources are there'
    ];

    discoveryQueries.forEach(query => {
      const primer = analyzeAndPrime(query);
      expect(primer).not.toBeNull();
      expect(primer!.message).toContain('resource');
    });
  });

  it('should return null for queries without special handling', () => {
    const primer = analyzeAndPrime('list all features in backlog');
    expect(primer).toBeNull();
  });

  it('should prioritize specific terminology over general discovery', () => {
    const primer = analyzeAndPrime('how do i find workspaces');
    expect(primer).not.toBeNull();
    expect(primer!.message).toContain('workspace');
    expect(primer!.message).not.toContain('resource guide');
  });
});

describe('Sampling - Primer Formatting', () => {
  it('should format primer with all sections', () => {
    const primer: ResourcePrimer = {
      message: 'Test message',
      suggestedResources: ['resource1', 'resource2'],
      exampleUris: ['uri1', 'uri2'],
      workflow: ['step1', 'step2']
    };

    const formatted = formatPrimer(primer);
    expect(formatted).toContain('Test message');
    expect(formatted).toContain('Suggested Resources:');
    expect(formatted).toContain('Example URIs:');
    expect(formatted).toContain('Recommended Workflow:');
    expect(formatted).toContain('resource1');
    expect(formatted).toContain('uri1');
    expect(formatted).toContain('step1');
  });

  it('should handle primer without workflow', () => {
    const primer: ResourcePrimer = {
      message: 'Test message',
      suggestedResources: ['resource1'],
      exampleUris: ['uri1']
    };

    const formatted = formatPrimer(primer);
    expect(formatted).toContain('Test message');
    expect(formatted).toContain('Suggested Resources:');
    expect(formatted).toContain('Example URIs:');
    expect(formatted).not.toContain('Recommended Workflow:');
  });

  it('should use markdown formatting', () => {
    const primer: ResourcePrimer = {
      message: 'Test',
      suggestedResources: ['res1'],
      exampleUris: ['uri1']
    };

    const formatted = formatPrimer(primer);
    expect(formatted).toContain('**');
    expect(formatted).toContain('- ');
  });
});

describe('Sampling - Public API', () => {
  it('should export getSamplingPrimer function', () => {
    expect(typeof getSamplingPrimer).toBe('function');
  });

  it('should return formatted primer string for workspace query', () => {
    const result = getSamplingPrimer('show me workspaces');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
    expect(result).toContain('workspace');
    expect(result).toContain('**');
  });

  it('should return null for queries without special handling', () => {
    const result = getSamplingPrimer('list features');
    expect(result).toBeNull();
  });
});

describe('Sampling - Edge Cases', () => {
  it('should handle empty query string', () => {
    const result = detectTerminology('');
    expect(result.synonyms.length).toBe(0);
    expect(result.canonical.length).toBe(0);
  });

  it('should handle case variations', () => {
    const queries = ['WORKSPACE', 'Workspace', 'workspace', 'WoRkSpAcE'];
    queries.forEach(query => {
      const result = detectTerminology(query);
      expect(result.synonyms).toContain('workspace');
    });
  });

  it('should handle queries with special characters', () => {
    const result = detectTerminology('show me workspaces!!! @#$%');
    expect(result.synonyms).toContain('workspace');
  });

  it('should handle very long queries', () => {
    const longQuery = 'I need to find workspaces ' + 'a'.repeat(1000);
    const result = detectTerminology(longQuery);
    expect(result.synonyms).toContain('workspace');
  });
});

describe('Sampling - Integration Scenarios', () => {
  it('should handle common user scenarios', () => {
    const scenarios = [
      { query: 'How do I see all my workspaces?', expectedTerm: 'workspace' },
      { query: 'Where can I find Product Areas?', expectedTerm: 'Product Area' },
      { query: 'Show me the workstreams for this quarter', expectedTerm: 'workstream' },
      { query: 'What resources are available?', shouldReturnPrimer: true }
    ];

    scenarios.forEach(scenario => {
      const primer = analyzeAndPrime(scenario.query);
      if ('expectedTerm' in scenario) {
        expect(primer).not.toBeNull();
        expect(primer!.message.toLowerCase()).toContain(scenario.expectedTerm.toLowerCase());
      } else if (scenario.shouldReturnPrimer) {
        expect(primer).not.toBeNull();
      }
    });
  });

  it('should provide actionable guidance in all primers', () => {
    const queries = [
      'workspaces',
      'Product Areas',
      'workstreams',
      'what resources are there'
    ];

    queries.forEach(query => {
      const primer = analyzeAndPrime(query);
      expect(primer).not.toBeNull();
      expect(primer!.suggestedResources.length).toBeGreaterThan(0);
      expect(primer!.exampleUris.length).toBeGreaterThan(0);

      // Verify all suggested resources start with aha://
      primer!.suggestedResources.forEach(resource => {
        expect(resource).toContain('aha://');
      });
    });
  });
});
