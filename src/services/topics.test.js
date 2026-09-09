import { describe, it, expect } from 'vitest';
import { slugify, normalizePath, buildTree, translateDbError } from './topics';
import { flattenInOrder } from '../hooks/useNavTree';

describe('slugify', () => {
  it('converts titles to URL-safe slugs', () => {
    expect(slugify('Rate Limiter')).toBe('rate-limiter');
    expect(slugify('Token Bucket & Sliding Window')).toBe('token-bucket-sliding-window');
  });

  it('strips accents and special characters', () => {
    expect(slugify('Café & Résumé')).toBe('cafe-resume');
    expect(slugify('System Design 101: Part 2!')).toBe('system-design-101-part-2');
  });

  it('handles empty or blank input cleanly', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('---hello-world---')).toBe('hello-world');
  });
});

describe('normalizePath', () => {
  it('removes leading and trailing slashes', () => {
    expect(normalizePath('/system-design/rate-limiter/')).toBe('system-design/rate-limiter');
    expect(normalizePath('///database///')).toBe('database');
    expect(normalizePath('')).toBe('');
    expect(normalizePath(null)).toBe('');
  });
});

describe('buildTree', () => {
  it('correctly nests flat nodes based on parent_id', () => {
    const flat = [
      { id: '1', parent_id: null, title: 'System Design', full_path: 'system-design' },
      { id: '2', parent_id: '1', title: 'Rate Limiter', full_path: 'system-design/rate-limiter' },
      { id: '3', parent_id: '2', title: 'Token Bucket', full_path: 'system-design/rate-limiter/token-bucket' },
      { id: '4', parent_id: null, title: 'Database', full_path: 'database' },
    ];

    const tree = buildTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].title).toBe('System Design');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].title).toBe('Rate Limiter');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].title).toBe('Token Bucket');
    expect(tree[1].title).toBe('Database');
    expect(tree[1].children).toHaveLength(0);
  });
});

describe('flattenInOrder', () => {
  it('linearizes hierarchical tree into document depth-first order', () => {
    const tree = [
      {
        id: '1',
        title: 'Parent 1',
        full_path: 'parent-1',
        children: [
          { id: '1a', title: 'Child 1A', full_path: 'parent-1/child-1a', children: [] },
          { id: '1b', title: 'Child 1B', full_path: 'parent-1/child-1b', children: [] },
        ],
      },
      {
        id: '2',
        title: 'Parent 2',
        full_path: 'parent-2',
        children: [],
      },
    ];

    const flat = flattenInOrder(tree);
    expect(flat.map((n) => n.id)).toEqual(['1', '1a', '1b', '2']);
  });
});

describe('translateDbError', () => {
  it('translates Postgres error codes into readable error messages', () => {
    expect(translateDbError({ code: '23505' }).message).toBe(
      'A topic with this slug already exists under the same parent.'
    );
    expect(translateDbError({ code: '23503' }).message).toBe('That parent topic no longer exists.');
    expect(translateDbError({ code: '42501' }).message).toBe(
      'You do not have permission to perform this action.'
    );
  });
});

describe('getTopicChildrenAndSiblings fallback behavior', () => {
  it('handles null or invalid topic gracefully', async () => {
    const { getTopicChildrenAndSiblings } = await import('./topics');
    const result = await getTopicChildrenAndSiblings(null);
    expect(result).toEqual({ children: [], siblings: [], parent: null });
  });
});

