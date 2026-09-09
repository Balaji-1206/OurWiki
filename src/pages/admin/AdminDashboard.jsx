import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  FolderTree,
  Folder,
  FolderOpen,
  FileText,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  Layers,
  X,
  BookOpen,
  FolderInput,
} from 'lucide-react';
import {
  getAllTopicsForAdmin,
  countSubtree,
  deleteTopic,
  updateTopicPosition,
  setPublishStatus,
  moveTopic,
} from '../../services/topics';
import LoadingState from '../../components/LoadingState';
import ErrorState from '../../components/ErrorState';

/** Helper to flatten nested tree to count metrics */
function flattenTree(nodes, list = []) {
  if (!nodes) return list;
  for (const n of nodes) {
    list.push(n);
    if (n.children?.length) {
      flattenTree(n.children, list);
    }
  }
  return list;
}

/** 1-Click Interactive Status Badge */
function StatusBadge({ status, onClick, disabled }) {
  const isPublished = status === 'published';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={isPublished ? 'Click to unpublish (set to draft)' : 'Click to publish live'}
      className={`group/badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition shadow-xs cursor-pointer ${
        isPublished
          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:hover:bg-emerald-900/80'
          : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:hover:bg-amber-900/80'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      <span className="capitalize">{status}</span>
    </button>
  );
}

/** Individual Tree Row */
function TreeRow({
  node,
  depth,
  siblings,
  index,
  isExpanded,
  onToggleExpand,
  onMove,
  onToggleStatus,
  onRequestMove,
  onRequestDelete,
  onCopyPath,
}) {
  const navigate = useNavigate();
  const hasChildren = node.children && node.children.length > 0;
  const canMoveUp = index > 0;
  const canMoveDown = index < siblings.length - 1;

  return (
    <>
      <div
        className={`group relative flex flex-wrap items-center gap-2 sm:gap-3 border-b border-border/50 px-3 sm:px-4 py-2.5 transition hover:bg-accent/[0.03] dark:border-gray-800/60 dark:hover:bg-gray-800/40 ${
          depth > 0 ? 'bg-paper/25 dark:bg-gray-900/20' : ''
        }`}
        style={{ paddingLeft: `${depth * 24 + 14}px` }}
      >
        {/* Tree branch connector for children */}
        {depth > 0 && (
          <div
            className="pointer-events-none absolute top-0 bottom-1/2 w-3.5 border-b-2 border-l-2 border-border/70 rounded-bl-md dark:border-gray-800"
            style={{ left: `${(depth - 1) * 24 + 18}px` }}
          />
        )}

        {/* Expand/Collapse Toggle & Icon */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(node.id)}
              className="flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              title={isExpanded ? 'Collapse subtopics' : 'Expand subtopics'}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 transition-transform" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 transition-transform" />
              )}
            </button>
          ) : (
            <div className="h-5 w-5" />
          )}

          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-accent dark:text-emerald-400" />
            ) : (
              <Folder className="h-4 w-4 text-accent dark:text-emerald-400" />
            )
          ) : (
            <FileText className="h-3.5 w-3.5 text-muted/60 dark:text-gray-500" />
          )}
        </div>

        {/* Title & Child Count Badge - Clicking the title navigates directly to the page */}
        <div className="flex min-w-[140px] flex-1 items-center gap-2">
          <Link
            to={`/${node.full_path}`}
            className="truncate text-sm font-semibold text-ink transition hover:text-accent hover:underline dark:text-gray-100 dark:hover:text-emerald-400"
            title={`Go to page: ${node.title}`}
          >
            {node.title}
          </Link>
          {hasChildren && (
            <span className="rounded-full bg-accent/10 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-accent dark:bg-emerald-950/80 dark:text-emerald-400">
              {node.children.length}
            </span>
          )}
        </div>

        {/* Status Pill (Interactive 1-Click Toggle) */}
        <div className="shrink-0">
          <StatusBadge
            status={node.status}
            onClick={() => onToggleStatus(node)}
          />
        </div>

        {/* Slug / Path Preview with Quick Copy */}
        <div className="hidden lg:flex items-center gap-1 font-mono text-[11px] text-muted dark:text-gray-400">
          <span className="max-w-[170px] truncate" title={`/${node.full_path}`}>
            /{node.full_path}
          </span>
          <button
            type="button"
            onClick={() => onCopyPath(node.full_path)}
            className="rounded p-1 text-muted/60 transition hover:bg-black/5 hover:text-accent dark:hover:bg-gray-800 dark:hover:text-emerald-400"
            title="Copy path URL"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>

        {/* Position Reordering Buttons */}
        <div className="flex items-center rounded-lg border border-border/80 bg-paper/40 p-0.5 shadow-2xs dark:border-gray-800 dark:bg-gray-900/60">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => onMove(siblings, index, -1)}
            className="rounded p-1 text-muted transition hover:bg-black/5 hover:text-ink disabled:opacity-20 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            title={canMoveUp ? 'Move topic up' : 'Already at top'}
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => onMove(siblings, index, 1)}
            className="rounded p-1 text-muted transition hover:bg-black/5 hover:text-ink disabled:opacity-20 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            title={canMoveDown ? 'Move topic down' : 'Already at bottom'}
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 text-xs">

          {/* Add Subpage Button */}
          <Link
            to={`/admin/topics/new?parent=${node.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-accent/20 bg-accent/5 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent hover:text-white dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white"
            title="Add child subpage under this topic"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">Subpage</span>
          </Link>

          {/* Edit Button */}
          <button
            type="button"
            onClick={() => navigate(`/admin/topics/${node.id}`)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 font-medium text-ink transition hover:border-accent hover:text-accent dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
          >
            <Edit className="h-3 w-3" />
            <span>Edit</span>
          </button>

          {/* Move / Re-parent Button */}
          <button
            type="button"
            onClick={() => onRequestMove(node)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 font-medium text-ink transition hover:border-accent hover:text-accent dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
            title="Move topic to another parent or root"
          >
            <FolderInput className="h-3 w-3 text-muted dark:text-gray-400" />
            <span className="hidden sm:inline">Move</span>
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => onRequestDelete(node)}
            className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            title="Delete topic"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Render children recursively when expanded */}
      {hasChildren &&
        isExpanded &&
        node.children.map((child, cIdx) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            siblings={node.children}
            index={cIdx}
            isExpanded={true}
            onToggleExpand={onToggleExpand}
            onMove={onMove}
            onToggleStatus={onToggleStatus}
            onRequestMove={onRequestMove}
            onRequestDelete={onRequestDelete}
            onCopyPath={onCopyPath}
          />
        ))}
    </>
  );
}

export default function AdminDashboard() {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);

  // Show transient toast
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => {
      setToast((current) => (current === msg ? null : current));
    }, 3000);
  }, []);

  const load = () => {
    setError(null);
    getAllTopicsForAdmin()
      .then((data) => {
        setTree(data);
        // By default, expand all parent nodes
        const flat = flattenTree(data);
        const parentIds = new Set(flat.filter((n) => n.children?.length > 0).map((n) => n.id));
        setExpandedIds(parentIds);
      })
      .catch(setError);
  };

  useEffect(load, []);

  // Compute stats across all topics
  const allFlat = useMemo(() => flattenTree(tree), [tree]);
  const stats = useMemo(() => {
    const total = allFlat.length;
    const published = allFlat.filter((n) => n.status === 'published').length;
    const draft = allFlat.filter((n) => n.status === 'draft').length;
    const categories = tree?.length || 0;
    return { total, published, draft, categories };
  }, [allFlat, tree]);

  // Toggle expand/collapse for an individual node
  const handleToggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Expand or collapse all
  const handleExpandAll = () => {
    const parentIds = new Set(allFlat.filter((n) => n.children?.length > 0).map((n) => n.id));
    setExpandedIds(parentIds);
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // 1-Click Status Toggle
  const handleToggleStatus = async (node) => {
    const nextStatus = node.status === 'published' ? 'draft' : 'published';
    try {
      await setPublishStatus(node.id, nextStatus);
      showToast(`Set "${node.title}" to ${nextStatus}`);
      load();
    } catch (e) {
      alert(`Could not update status: ${e.message}`);
    }
  };

  // Sibling topic reordering
  const handleMoveSibling = async (siblings, index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const current = siblings[index];
    const target = siblings[targetIndex];

    try {
      await updateTopicPosition(current.id, target.position ?? targetIndex);
      await updateTopicPosition(target.id, current.position ?? index);
      showToast(`Reordered "${current.title}"`);
      load();
    } catch (e) {
      alert('Could not update position: ' + e.message);
    }
  };

  // Copy path helper
  const handleCopyPath = (fullPath) => {
    const url = `${window.location.origin}/${fullPath}`;
    navigator.clipboard?.writeText(url);
    showToast(`Copied link: /${fullPath}`);
  };

  // Request deletion modal
  const handleRequestDelete = async (node) => {
    try {
      const count = await countSubtree(node.full_path);
      setDeleteTarget({ node, count, busy: false });
    } catch (_) {
      setDeleteTarget({ node, count: 1, busy: false });
    }
  };

  // Confirm deletion
  const confirmDelete = async () => {
    if (!deleteTarget?.node) return;
    setDeleteTarget((prev) => ({ ...prev, busy: true }));
    try {
      await deleteTopic(deleteTarget.node.id);
      showToast(`Deleted topic "${deleteTarget.node.title}"`);
      setDeleteTarget(null);
      load();
    } catch (e) {
      alert(`Could not delete topic: ${e.message}`);
      setDeleteTarget(null);
    }
  };

  // Request move / re-parent modal
  const handleRequestMove = (node) => {
    setMoveTarget({ node, newParentId: node.parent_id || '', busy: false });
  };

  // Confirm move
  const confirmMove = async () => {
    if (!moveTarget?.node) return;
    setMoveTarget((prev) => ({ ...prev, busy: true }));
    try {
      const parentId = moveTarget.newParentId ? moveTarget.newParentId : null;
      await moveTopic(moveTarget.node.id, parentId, moveTarget.node.slug);
      showToast(`Moved "${moveTarget.node.title}" successfully`);
      setMoveTarget(null);
      load();
    } catch (e) {
      alert(`Could not move topic: ${e.message}`);
      setMoveTarget((prev) => ({ ...prev, busy: false }));
    }
  };

  // Filter valid parent destinations (exclude self and own descendants)
  const validMoveParents = useMemo(() => {
    if (!moveTarget?.node) return [];
    const n = moveTarget.node;
    return allFlat.filter(
      (item) => item.id !== n.id && !item.full_path.startsWith(`${n.full_path}/`)
    );
  }, [moveTarget, allFlat]);

  // Preview new URL path
  const previewNewPath = useMemo(() => {
    if (!moveTarget?.node) return '';
    const n = moveTarget.node;
    if (!moveTarget.newParentId) return n.slug;
    const parent = allFlat.find((item) => item.id === moveTarget.newParentId);
    return parent ? `${parent.full_path}/${n.slug}` : n.slug;
  }, [moveTarget, allFlat]);

  // Filter tree recursively
  const filteredTree = useMemo(() => {
    if (!tree) return [];
    if (!search.trim() && statusFilter === 'all') return tree;

    const query = search.toLowerCase().trim();

    function filterNode(node) {
      const matchSearch =
        !query ||
        node.title.toLowerCase().includes(query) ||
        node.full_path.toLowerCase().includes(query);
      const matchStatus = statusFilter === 'all' || node.status === statusFilter;

      const filteredChildren = (node.children || []).map(filterNode).filter(Boolean);

      if ((matchSearch && matchStatus) || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    }

    return tree.map(filterNode).filter(Boolean);
  }, [tree, search, statusFilter]);

  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!tree) return <LoadingState label="Loading topics hierarchy..." />;

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-semibold text-ink shadow-xl transition-all dark:border-gray-700 dark:bg-gray-800 dark:text-white">
          <Check className="h-4 w-4 text-emerald-500" />
          <span>{toast}</span>
        </div>
      )}

      {/* Safe Deletion Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-xs transition-opacity dark:bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink dark:text-white">Delete Topic</h3>
                <p className="font-mono text-xs text-muted dark:text-gray-400">/{deleteTarget.node.full_path}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border/80 bg-paper/50 p-3.5 text-xs dark:border-gray-800 dark:bg-gray-800/40">
              <p className="font-semibold text-ink dark:text-gray-200">{deleteTarget.node.title}</p>
              {deleteTarget.count > 1 ? (
                <div className="mt-2 text-amber-700 dark:text-amber-400">
                  <p className="font-bold">⚠️ Cascade warning:</p>
                  <p className="mt-1">
                    This topic has <strong>{deleteTarget.count - 1}</strong> child subpage(s). Deleting it will permanently delete this topic and all of its subpages.
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-muted dark:text-gray-400">
                  Are you sure you want to delete this topic? This action cannot be undone.
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteTarget.busy}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted hover:text-ink dark:border-gray-700 dark:text-gray-300 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteTarget.busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleteTarget.busy ? 'Deleting...' : 'Delete Topic'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move / Re-Parent Modal */}
      {moveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-xs transition-opacity dark:bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent dark:bg-emerald-950/60 dark:text-emerald-400">
                <FolderInput className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink dark:text-white">Move Topic</h3>
                <p className="font-mono text-xs text-muted dark:text-gray-400">/{moveTarget.node.full_path}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="rounded-xl border border-border/70 bg-paper/40 p-3 dark:border-gray-800 dark:bg-gray-800/30">
                <span className="text-muted dark:text-gray-400">Topic:</span>
                <p className="font-semibold text-ink dark:text-white mt-0.5">{moveTarget.node.title}</p>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-muted dark:text-gray-400 mb-1.5">
                  Select New Parent Category
                </label>
                <select
                  value={moveTarget.newParentId}
                  onChange={(e) => setMoveTarget((m) => ({ ...m, newParentId: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-paper/50 p-2.5 text-xs text-ink outline-none transition focus:border-accent dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-emerald-500"
                >
                  <option value="">📁 [ Top Level / Root Category ]</option>
                  {validMoveParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {'— '.repeat(p.depth ?? 0)} {p.title} (/{p.full_path})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-border/80 bg-paper/60 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <span className="text-[11px] font-medium text-muted dark:text-gray-400">Preview New URL:</span>
                <div className="font-mono text-xs font-semibold text-ink dark:text-emerald-400 mt-0.5">
                  /{previewNewPath}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMoveTarget(null)}
                disabled={moveTarget.busy}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted hover:text-ink dark:border-gray-700 dark:text-gray-300 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMove}
                disabled={moveTarget.busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-light disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {moveTarget.busy ? 'Moving...' : 'Move Topic'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & New Topic Button */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink dark:text-white">
            Topic Management
          </h1>
          <p className="mt-1 text-xs text-muted dark:text-gray-400">
            Organize, publish, reorder hierarchy topics and direct subpages.
          </p>
        </div>

        <Link
          to="/admin/topics/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-light dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          <span>New Topic</span>
        </Link>
      </div>

      {/* Metric / Overview KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Topics */}
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`group flex flex-col rounded-2xl border p-4 text-left transition shadow-xs ${
            statusFilter === 'all'
              ? 'border-accent bg-accent/5 ring-1 ring-accent/30 dark:border-emerald-500 dark:bg-emerald-950/20'
              : 'border-border/80 bg-white hover:border-accent/50 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between text-muted dark:text-gray-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Topics</span>
            <Layers className="h-4 w-4 text-accent dark:text-emerald-400" />
          </div>
          <span className="mt-2 text-2xl font-black text-ink dark:text-white">{stats.total}</span>
          <span className="text-[10px] text-muted dark:text-gray-400">All documentation pages</span>
        </button>

        {/* Published */}
        <button
          type="button"
          onClick={() => setStatusFilter('published')}
          className={`group flex flex-col rounded-2xl border p-4 text-left transition shadow-xs ${
            statusFilter === 'published'
              ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/30 dark:border-emerald-500 dark:bg-emerald-950/30'
              : 'border-border/80 bg-white hover:border-emerald-400/50 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between text-muted dark:text-gray-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Published</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">{stats.published}</span>
          <span className="text-[10px] text-muted dark:text-gray-400">Live for readers</span>
        </button>

        {/* Drafts */}
        <button
          type="button"
          onClick={() => setStatusFilter('draft')}
          className={`group flex flex-col rounded-2xl border p-4 text-left transition shadow-xs ${
            statusFilter === 'draft'
              ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500/30 dark:border-amber-500 dark:bg-amber-950/30'
              : 'border-border/80 bg-white hover:border-amber-400/50 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between text-muted dark:text-gray-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">In Draft</span>
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="mt-2 text-2xl font-black text-amber-700 dark:text-amber-300">{stats.draft}</span>
          <span className="text-[10px] text-muted dark:text-gray-400">WIP &amp; unpublished</span>
        </button>

        {/* Categories */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
            setSearch('');
          }}
          className="group flex flex-col rounded-2xl border border-border/80 bg-white p-4 text-left transition shadow-xs hover:border-accent/50 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-gray-700"
        >
          <div className="flex items-center justify-between text-muted dark:text-gray-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Root Categories</span>
            <BookOpen className="h-4 w-4 text-accent dark:text-emerald-400" />
          </div>
          <span className="mt-2 text-2xl font-black text-ink dark:text-white">{stats.categories}</span>
          <span className="text-[10px] text-muted dark:text-gray-400">Top-level sections</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input with clear button */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted dark:text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topics by title, slug or path..."
            className="w-full rounded-xl border border-border bg-white py-2 pl-9 pr-8 text-xs outline-none transition focus:border-accent dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-emerald-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-muted hover:text-ink dark:text-gray-400 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 text-xs text-muted dark:text-gray-400">
          <span>Status:</span>
          {['all', 'published', 'draft'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-2.5 py-1.5 capitalize transition font-medium ${
                statusFilter === status
                  ? 'bg-accent text-white shadow-xs dark:bg-emerald-600'
                  : 'border border-border bg-white text-muted hover:text-ink dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Expand / Collapse All */}
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={handleExpandAll}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition hover:border-accent hover:text-ink dark:border-gray-800 dark:text-gray-400 dark:hover:text-white"
            title="Expand all tree nodes"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition hover:border-accent hover:text-ink dark:border-gray-800 dark:text-gray-400 dark:hover:text-white"
            title="Collapse all tree nodes"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Tree Card */}
      {filteredTree.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted dark:border-gray-800 dark:text-gray-500">
          <FolderTree className="mx-auto h-8 w-8 text-muted/50 mb-2" />
          <p className="text-sm font-medium text-ink dark:text-gray-300">
            {search ? 'No topics match your filter query.' : 'No topics found.'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {search ? 'Try clearing your search query or filter.' : 'Create your first topic to get started.'}
          </p>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline dark:text-emerald-400"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/60">
          <div className="flex items-center justify-between border-b border-border bg-paper/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5 text-accent dark:text-emerald-400" />
              <span>Hierarchy Tree</span>
            </span>
            <span>
              Showing {filteredTree.length} root section{filteredTree.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="divide-y divide-border/50 dark:divide-gray-800/50">
            {filteredTree.map((node, idx) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                siblings={filteredTree}
                index={idx}
                isExpanded={expandedIds.has(node.id) || !!search.trim()}
                onToggleExpand={handleToggleExpand}
                onMove={handleMoveSibling}
                onToggleStatus={handleToggleStatus}
                onRequestMove={handleRequestMove}
                onRequestDelete={handleRequestDelete}
                onCopyPath={handleCopyPath}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
