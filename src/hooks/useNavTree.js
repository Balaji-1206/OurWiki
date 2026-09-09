import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getNavTree } from '../services/topics';

let cache = null;

export function clearNavTreeCache() {
  cache = null;
}

export function useNavTree() {
  const [tree, setTree] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(null);
  const location = useLocation();

  const refresh = useCallback(async (force = false) => {
    if (!force && cache && cache.length > 0) {
      setTree(cache);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await getNavTree();
      cache = data;
      setTree(data);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-check navigation on route changes so newly created topics appear immediately
  useEffect(() => {
    refresh(true);
  }, [refresh, location.pathname]);

  return { tree: tree ?? [], loading, error, refresh };
}

/** Flatten the tree in document order — the order a reader would encounter
 *  pages in a linear read-through — for Prev/Next links. */
export function flattenInOrder(tree) {
  const out = [];
  const walk = (nodes) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return out;
}
