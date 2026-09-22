import { describe, expect, it } from 'vitest';
import { shouldNodeBeExpanded } from '../src/pages/admin/AdminDashboard.jsx';

describe('shouldNodeBeExpanded', () => {
  it('expands a child directory when it is explicitly marked expanded', () => {
    const expandedIds = new Set(['parent-1', 'child-1']);

    expect(shouldNodeBeExpanded('child-1', expandedIds, '')).toBe(true);
    expect(shouldNodeBeExpanded('child-2', expandedIds, '')).toBe(false);
  });

  it('keeps child directories collapsed until they are toggled open', () => {
    const expandedIds = new Set(['parent-1']);

    expect(shouldNodeBeExpanded('child-1', expandedIds, '')).toBe(false);
  });

  it('shows all children while a search is active', () => {
    const expandedIds = new Set();

    expect(shouldNodeBeExpanded('child-1', expandedIds, 'network')).toBe(true);
  });
});
