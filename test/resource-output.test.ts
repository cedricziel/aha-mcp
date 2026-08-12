import { describe, it, expect } from 'bun:test';
import { resourceAnnotations, renderRecord, renderCollection, renderTable } from '../src/core/resource-output.js';

describe('resourceAnnotations', () => {
  it('always addresses both user and assistant at priority 0.8', () => {
    const annotations = resourceAnnotations();
    expect(annotations.audience).toEqual(['user', 'assistant']);
    expect(annotations.priority).toBe(0.8);
  });

  it('includes lastModified for a plainly-Zulu updated_at', () => {
    const annotations = resourceAnnotations({ updated_at: '2024-01-15T10:30:00.000Z' });
    expect(annotations.lastModified).toBe('2024-01-15T10:30:00.000Z');
  });

  it('also accepts a Zulu timestamp with no fractional seconds', () => {
    const annotations = resourceAnnotations({ updated_at: '2024-01-15T10:30:00Z' });
    expect(annotations.lastModified).toBe('2024-01-15T10:30:00Z');
  });

  it('drops a numeric-offset timestamp rather than risking a rejected annotation', () => {
    // The SDK types lastModified as z.iso.datetime(), which rejects a numeric offset. An
    // omitted annotation costs a hint; a rejected one costs the whole read.
    const annotations = resourceAnnotations({ updated_at: '2024-01-15T10:30:00.000+02:00' });
    expect(annotations.lastModified).toBeUndefined();
  });

  it('omits lastModified when updated_at is missing, non-string, or absent record', () => {
    expect(resourceAnnotations({}).lastModified).toBeUndefined();
    expect(resourceAnnotations({ updated_at: null }).lastModified).toBeUndefined();
    expect(resourceAnnotations({ updated_at: 12345 }).lastModified).toBeUndefined();
    expect(resourceAnnotations(undefined).lastModified).toBeUndefined();
  });
});

describe('renderRecord', () => {
  it('renders a heading, a labelled link, and a bullet for every present field', () => {
    const text = renderRecord(
      {
        reference_num: 'PRJ1-123',
        name: 'Ship the widget',
        url: 'https://test.aha.io/features/PRJ1-123',
        resource: 'https://test.aha.io/api/v1/features/PRJ1-123',
        workspace_id: '42',
        progress: 40,
        score: 12,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-15T10:30:00.000Z'
      },
      'Feature'
    );

    expect(text).toContain('## Feature');
    expect(text).toContain('[PRJ1-123 - Ship the widget](https://test.aha.io/features/PRJ1-123)');
    expect(text).toContain('**Reference:** PRJ1-123');
    expect(text).toContain('**Name:** Ship the widget');
    expect(text).toContain('**Workspace:** 42');
    expect(text).toContain('**Progress:** 40%');
    expect(text).toContain('**Score:** 12');
    expect(text).toContain('**Created:** 2024-01-01T00:00:00.000Z');
    expect(text).toContain('**Updated:** 2024-01-15T10:30:00.000Z');

    // record.resource is a REST endpoint, never a page for a person to open.
    expect(text).not.toContain('resource');
    expect(text).not.toContain('api/v1');
  });

  it('never links to record.resource even when url is absent', () => {
    const text = renderRecord(
      {
        reference_num: 'PRJ1-1',
        name: 'No web page',
        resource: 'https://test.aha.io/api/v1/features/PRJ1-1'
      },
      'Feature'
    );

    expect(text).not.toContain('](https://test.aha.io/api/v1/features/PRJ1-1)');
    expect(text).not.toContain('api/v1');
  });

  it('omits the link when url, reference_num or name is missing', () => {
    const noUrl = renderRecord({ reference_num: 'PRJ1-1', name: 'No link' }, 'Feature');
    expect(noUrl).not.toContain('](');

    const noName = renderRecord(
      { reference_num: 'PRJ1-1', url: 'https://test.aha.io/features/PRJ1-1' },
      'Feature'
    );
    expect(noName).not.toContain('](');

    const noRef = renderRecord(
      { name: 'No ref', url: 'https://test.aha.io/features/PRJ1-1' },
      'Feature'
    );
    expect(noRef).not.toContain('](');
  });

  it('never invents a bullet for a missing or null field', () => {
    const text = renderRecord(
      { reference_num: 'PRJ1-1', name: 'Bare record', progress: null, score: undefined },
      'Feature'
    );

    expect(text).toContain('**Reference:** PRJ1-1');
    expect(text).toContain('**Name:** Bare record');
    expect(text).not.toContain('Workspace');
    expect(text).not.toContain('Progress');
    expect(text).not.toContain('Score');
    expect(text).not.toContain('Created');
    expect(text).not.toContain('Updated');
  });

  it('handles a record with no describable fields at all', () => {
    const text = renderRecord({}, 'Feature');
    expect(text).toBe('## Feature');
  });

  it('renders a progress of zero rather than treating it as missing', () => {
    const text = renderRecord({ reference_num: 'PRJ1-1', name: 'Just started', progress: 0 }, 'Feature');
    expect(text).toContain('**Progress:** 0%');
  });
});

describe('renderCollection', () => {
  it('reports the default empty message when there are no records', () => {
    const text = renderCollection([], { title: 'Features' });
    expect(text).toBe('## Features\n\nNo matching records.');
  });

  it('uses a caller-supplied empty message', () => {
    const text = renderCollection([], { title: 'Features', emptyMessage: 'No features in this product.' });
    expect(text).toBe('## Features\n\nNo features in this product.');
  });

  it('renders one link per record plus a trailing count', () => {
    const text = renderCollection(
      [
        { reference_num: 'PRJ1-1', name: 'First', url: 'https://test.aha.io/features/PRJ1-1' },
        { reference_num: 'PRJ1-2', name: 'Second', url: 'https://test.aha.io/features/PRJ1-2' }
      ],
      { title: 'Features' }
    );

    const lines = text.split('\n');
    expect(lines[0]).toBe('## Features');
    expect(lines[1]).toBe('- [PRJ1-1 - First](https://test.aha.io/features/PRJ1-1)');
    expect(lines[2]).toBe('- [PRJ1-2 - Second](https://test.aha.io/features/PRJ1-2)');
    expect(lines[3]).toBe('2 records listed.');
  });

  it('falls back to a plain text line when a record has no url', () => {
    const text = renderCollection([{ reference_num: 'PRJ1-1', name: 'No page' }], { title: 'Features' });

    expect(text).toContain('- PRJ1-1 - No page');
    expect(text).not.toContain('](');
    expect(text).toContain('1 record listed.');
  });

  it('falls back to the reference number when a record has no name', () => {
    const text = renderCollection(
      [{ reference_num: 'PRJ1-1', url: 'https://test.aha.io/features/PRJ1-1' }],
      { title: 'Features' }
    );

    expect(text).toContain('- [PRJ1-1](https://test.aha.io/features/PRJ1-1)');
  });

  it('skips a record with neither a name nor a reference number', () => {
    const text = renderCollection(
      [
        { url: 'https://test.aha.io/features/PRJ1-1' },
        { reference_num: 'PRJ1-2', name: 'Kept', url: 'https://test.aha.io/features/PRJ1-2' }
      ],
      { title: 'Features' }
    );

    expect(text).not.toContain('https://test.aha.io/features/PRJ1-1)');
    expect(text).toContain('- [PRJ1-2 - Kept](https://test.aha.io/features/PRJ1-2)');
    expect(text).toContain('1 record listed.');
  });

  it('never links to record.resource, only to record.url', () => {
    const text = renderCollection(
      [
        {
          reference_num: 'PRJ1-1',
          name: 'Has both',
          resource: 'https://test.aha.io/api/v1/features/PRJ1-1'
        }
      ],
      { title: 'Features' }
    );

    expect(text).toContain('- PRJ1-1 - Has both');
    expect(text).not.toContain('api/v1');
    expect(text).not.toContain('](');
  });

  it('guards against non-object entries in the array', () => {
    const text = renderCollection(
      [null, 'not a record', 42, { reference_num: 'PRJ1-1', name: 'Kept' }],
      { title: 'Features' }
    );

    expect(text).toContain('- PRJ1-1 - Kept');
    expect(text).toContain('1 record listed.');
  });
});

describe('renderTable', () => {
  const ideaColumns = [
    { header: 'Ref', path: 'reference_num' },
    { header: 'Name', path: 'name' },
    { header: 'Status', path: 'workflow_status.name' },
    { header: 'Created', path: 'created_at' }
  ];

  it('reports the default empty message when there are no records', () => {
    const text = renderTable([], { title: 'Ideas', columns: ideaColumns });
    expect(text).toBe('## Ideas\n\nNo matching records.');
  });

  it('uses a caller-supplied empty message', () => {
    const text = renderTable([], { title: 'Ideas', columns: ideaColumns, emptyMessage: 'No ideas yet.' });
    expect(text).toBe('## Ideas\n\nNo ideas yet.');
  });

  it('renders a header row, a separator row, one data row per record, and a trailing count', () => {
    const text = renderTable(
      [
        {
          reference_num: 'PRJ1-1',
          name: 'Dark mode',
          url: 'https://test.aha.io/ideas/PRJ1-1',
          workflow_status: { name: 'New' },
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ],
      { title: 'Ideas', columns: ideaColumns }
    );

    const lines = text.split('\n');
    expect(lines[0]).toBe('## Ideas');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('| Ref | Name | Status | Created |');
    expect(lines[3]).toBe('| --- | --- | --- | --- |');
    expect(lines[4]).toBe(
      '| [PRJ1-1](https://test.aha.io/ideas/PRJ1-1) | Dark mode | New | 2024-01-01T00:00:00.000Z |'
    );
    expect(lines[5]).toBe('');
    expect(lines[6]).toBe('1 record listed.');
  });

  it('links the first column to record.url and pluralizes the count for multiple rows', () => {
    const text = renderTable(
      [
        { reference_num: 'PRJ1-1', name: 'First', url: 'https://test.aha.io/ideas/PRJ1-1' },
        { reference_num: 'PRJ1-2', name: 'Second', url: 'https://test.aha.io/ideas/PRJ1-2' }
      ],
      { title: 'Ideas', columns: [{ header: 'Ref', path: 'reference_num' }, { header: 'Name', path: 'name' }] }
    );

    expect(text).toContain('| [PRJ1-1](https://test.aha.io/ideas/PRJ1-1) | First |');
    expect(text).toContain('| [PRJ1-2](https://test.aha.io/ideas/PRJ1-2) | Second |');
    expect(text).toContain('2 records listed.');
  });

  it('falls back to plain text in the first column when url is absent', () => {
    const text = renderTable(
      [{ reference_num: 'PRJ1-1', name: 'No page' }],
      { title: 'Ideas', columns: [{ header: 'Ref', path: 'reference_num' }, { header: 'Name', path: 'name' }] }
    );

    expect(text).toContain('| PRJ1-1 | No page |');
    expect(text).not.toContain('](');
  });

  it('links whatever the first configured column resolves to, not a hardcoded reference_num', () => {
    // Products have no `reference_num` at all - `reference_prefix` (KG, APPO11Y, ...) is the
    // identifier people actually address a workspace by. renderTable must not assume the first
    // column is named `reference_num`; it links whatever `columns[0].path` resolves to.
    const text = renderTable(
      [{ reference_prefix: 'KG', name: 'Knowledge Graph', workspace_type: 'product', url: 'https://test.aha.io/products/KG' }],
      {
        title: 'Products',
        columns: [
          { header: 'Prefix', path: 'reference_prefix' },
          { header: 'Name', path: 'name' },
          { header: 'Type', path: 'workspace_type' }
        ]
      }
    );

    expect(text).toContain('| [KG](https://test.aha.io/products/KG) | Knowledge Graph | product |');
  });

  it('resolves a nested dot path, e.g. workflow_status.name or owner.name', () => {
    const text = renderTable(
      [{ reference_num: 'PRJ1-1', name: 'Has status', workflow_status: { name: 'In progress' } }],
      { title: 'Ideas', columns: ideaColumns }
    );

    expect(text).toContain('In progress');
  });

  it('resolves a missing intermediate object in a dot path to "-" instead of throwing', () => {
    // No `workflow_status` at all - the walk stops at the first missing step.
    const noIntermediate = renderTable(
      [{ reference_num: 'PRJ1-1', name: 'No status object' }],
      { title: 'Ideas', columns: ideaColumns }
    );
    expect(noIntermediate).toContain('| PRJ1-1 | No status object | - |');

    // `workflow_status` present but null - same outcome, the walk still can't descend further.
    const nullIntermediate = renderTable(
      [{ reference_num: 'PRJ1-2', name: 'Null status', workflow_status: null }],
      { title: 'Ideas', columns: ideaColumns }
    );
    expect(nullIntermediate).toContain('| PRJ1-2 | Null status | - |');

    // `workflow_status.name` itself missing - the walk completes but the leaf is undefined.
    const missingLeaf = renderTable(
      [{ reference_num: 'PRJ1-3', name: 'No name field', workflow_status: {} }],
      { title: 'Ideas', columns: ideaColumns }
    );
    expect(missingLeaf).toContain('| PRJ1-3 | No name field | - |');
  });

  it('renders a boolean column as Yes/No rather than the literal true/false', () => {
    const text = renderTable(
      [
        { reference_num: 'REL-1', name: 'GA', parking_lot: false },
        { reference_num: 'REL-2', name: 'Someday', parking_lot: true }
      ],
      {
        title: 'Releases',
        columns: [
          { header: 'Ref', path: 'reference_num' },
          { header: 'Name', path: 'name' },
          { header: 'ParkingLot', path: 'parking_lot' }
        ]
      }
    );

    expect(text).toContain('| REL-1 | GA | No |');
    expect(text).toContain('| REL-2 | Someday | Yes |');
  });

  it('escapes a pipe and collapses a newline inside a cell so they cannot break the row', () => {
    const text = renderTable(
      [{ reference_num: 'PRJ1-1', name: 'Weird | name\nwith a break' }],
      { title: 'Ideas', columns: [{ header: 'Ref', path: 'reference_num' }, { header: 'Name', path: 'name' }] }
    );

    expect(text).toContain('Weird \\| name with a break');
  });

  it('prints "-" for a column path that resolves to an object or array rather than a scalar', () => {
    const text = renderTable(
      [{ reference_num: 'PRJ1-1', name: 'Has nested data', tags: ['a', 'b'] }],
      { title: 'Ideas', columns: [{ header: 'Ref', path: 'reference_num' }, { header: 'Tags', path: 'tags' }] }
    );

    expect(text).toContain('| PRJ1-1 | - |');
  });

  it('guards against non-object entries in the array', () => {
    const text = renderTable(
      [null, 'not a record', 42, { reference_num: 'PRJ1-1', name: 'Kept' }],
      { title: 'Ideas', columns: [{ header: 'Ref', path: 'reference_num' }, { header: 'Name', path: 'name' }] }
    );

    expect(text).toContain('| PRJ1-1 | Kept |');
    expect(text).toContain('1 record listed.');
  });
});
