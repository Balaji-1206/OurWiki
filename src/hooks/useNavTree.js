import { useEffect, useState, useCallback } from 'react';
import { getNavTree } from '../services/topics';

let cache = null; // module-level cache: one fetch per page session, not per component

export function useNavTree() {
  const [tree, setTree] = useState(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
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

  useEffect(() => {
    if (!cache) refresh();
  }, [refresh]);

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
