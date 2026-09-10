import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  ArrowRight,
  Search,
  X,
  Plus,
  FileText,
  Folder,
  Globe,
  Compass,
} from 'lucide-react';
import { useNavTree } from '../hooks/useNavTree';
import { useAuth } from '../contexts/AuthContext';
import LoadingState from '../components/LoadingState';

/**
 * Linearize nested tree into flat nodes with parent chain metadata for deep searching
 */
function extractAllTopicsWithParentInfo(tree, parentTitle = null) {
  const list = [];
  for (const node of tree) {
    list.push({
      ...node,
      isParent: node.depth === 0 || !node.parent_id,
      parentTitle,
    });
    if (node.children?.length > 0) {
      list.push(...extractAllTopicsWithParentInfo(node.children, node.title));
    }
  }
  return list;
}

function extractSnippet(text, query, maxLength = 130) {
  if (!text) return '';
  if (!query?.trim()) return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  }

  const start = Math.max(0, matchIndex - 35);
  const end = Math.min(text.length, matchIndex + lowerQuery.length + 80);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

function HighlightedText({ text, query }) {
  if (!text) return null;
  if (!query?.trim()) return <span>{text}</span>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase().trim() ? (
          <mark
            key={i}
            className="rounded bg-yellow-200 px-0.5 font-semibold text-ink dark:bg-yellow-500/30 dark:text-yellow-200"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

export default function HomePage() {
  const { tree, loading } = useNavTree();
  const { isAuthenticated } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'parents' | 'children'

  // Extract all flat topics with hierarchy information
  const allFlatTopics = useMemo(() => {
    return extractAllTopicsWithParentInfo(tree);
  }, [tree]);

  // Statistics
  const parentTopics = useMemo(() => {
    return tree.filter((t) => !t.parent_id || t.depth === 0);
  }, [tree]);

  const parentTopicsCount = parentTopics.length;
  const childTopicsCount = allFlatTopics.filter((t) => !t.isParent).length;
  const totalTopicsCount = allFlatTopics.length;

  // Search filter logic across both parent and child topics
  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allFlatTopics.filter((topic) => {
      // Filter by type if selected
      if (activeFilter === 'parents' && !topic.isParent) return false;
      if (activeFilter === 'children' && topic.isParent) return false;

      if (!q) return true;

      const titleMatch = topic.title?.toLowerCase().includes(q);
      const slugMatch = topic.slug?.toLowerCase().includes(q);
      const pathMatch = topic.full_path?.toLowerCase().includes(q);
      const descMatch = topic.meta_description?.toLowerCase().includes(q);
      const parentMatch = topic.parentTitle?.toLowerCase().includes(q);

      return titleMatch || slugMatch || pathMatch || descMatch || parentMatch;
    });
  }, [allFlatTopics, searchQuery, activeFilter]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Clean Hero Header (No architecture jargon) */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900/60">
        

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl dark:text-white">
          Documentation &amp; Wiki
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted dark:text-gray-400">
          Find information, browse documentation topics, and collaborate with your team.
          Search across all parent topics and subpages below.
        </p>

        {/* Live Search Bar for Parent and Child Topics */}
        <div className="mt-6 max-w-2xl">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-muted dark:text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all parent topics and child pages..."
              className="w-full rounded-xl border border-border bg-paper/50 py-2.5 pl-10 pr-10 text-sm text-ink outline-none transition focus:border-accent focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 rounded-lg p-1 text-muted hover:text-ink dark:text-gray-400 dark:hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState label="Loading topics..." />
      ) : searchQuery.trim() ? (
        /* ================= Search Results View ================= */
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink dark:text-white">
              Search Results ({filteredTopics.length})
            </h2>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
              className="text-xs text-accent hover:underline dark:text-emerald-400"
            >
              Clear search
            </button>
          </div>

          {filteredTopics.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted dark:border-gray-800 dark:text-gray-500">
              <Search className="mx-auto h-7 w-7 opacity-40" />
              <p className="mt-2 text-sm font-medium">No topics found matching "{searchQuery}".</p>
              <p className="mt-1 text-xs text-muted/70">Try searching for other words or reset the filter.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredTopics.map((topic) => (
                <Link
                  key={topic.id}
                  to={`/${topic.full_path}`}
                  className="group flex flex-col justify-between rounded-xl border border-border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-emerald-500"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          topic.isParent
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {topic.isParent ? (
                          <>
                            <Folder className="h-3 w-3" />
                            <span>Parent Topic</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-3 w-3" />
                            <span>Sub Topics</span>
                          </>
                        )}
                      </span>

                      <span className="font-mono text-[11px] text-muted dark:text-gray-500">
                        /{topic.slug}
                      </span>
                    </div>

                    <h3 className="mt-2.5 text-base font-semibold text-ink group-hover:text-accent dark:text-gray-100 dark:group-hover:text-emerald-400">
                      <HighlightedText text={topic.title} query={searchQuery} />
                    </h3>

                    {topic.parentTitle && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted dark:text-gray-400">
                        <span>Parent:</span>
                        <span className="font-medium text-ink/80 dark:text-gray-200">
                          {topic.parentTitle}
                        </span>
                      </p>
                    )}

                    {topic.meta_description ? (
                      <div className="mt-2 rounded-lg bg-paper/60 p-2 text-xs leading-relaxed text-muted dark:bg-gray-800/50 dark:text-gray-300">
                        <HighlightedText
                          text={extractSnippet(topic.meta_description, searchQuery)}
                          query={searchQuery}
                        />
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-muted/70 dark:text-gray-500">
                        <span>Path: </span>
                        <HighlightedText text={`/${topic.full_path}`} query={searchQuery} />
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-xs font-medium text-accent dark:border-gray-800/80 dark:text-emerald-400">
                    <span className="font-mono text-[11px] text-muted dark:text-gray-500">
                      /{topic.full_path}
                    </span>
                    <div className="flex items-center gap-1 transition group-hover:translate-x-1">
                      <span>View</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ================= Parent Topics Showcase Directory ================= */
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-ink dark:text-white">
                All Topics
              </h2>
              <p className="text-xs text-muted dark:text-gray-400">
                Browse through the topics below and explore their child subpages.
              </p>
            </div>

            {isAuthenticated && (
              <Link
                to="/admin/topics/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-light dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Topic</span>
              </Link>
            )}
          </div>

          {parentTopics.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted dark:border-gray-800 dark:text-gray-500">
              <BookOpen className="mx-auto h-8 w-8 opacity-40" />
              <p className="mt-3 text-sm font-medium">No topics have been published yet.</p>
              {isAuthenticated ? (
                <Link
                  to="/admin/topics/new"
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-light dark:bg-emerald-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create the first topic</span>
                </Link>
              ) : (
                <p className="mt-1 text-xs text-muted/70">Sign in to add the first topic to the wiki.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {parentTopics.map((topic) => {
                const directChildren = topic.children || [];
                const childCount = directChildren.length;

                return (
                  <div
                    key={topic.id}
                    className="group relative flex flex-col justify-between rounded-xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-emerald-500"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent dark:bg-emerald-950/60 dark:text-emerald-400">
                          <BookOpen className="h-4 w-4" />
                        </div>

                        <div className="flex items-center gap-2">
                          {childCount > 0 && (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent dark:bg-emerald-950/80 dark:text-emerald-400">
                              {childCount} {childCount === 1 ? 'child page' : 'child pages'}
                            </span>
                          )}
                          <span className="font-mono text-[11px] text-muted dark:text-gray-500">
                            /{topic.slug}
                          </span>
                        </div>
                      </div>

                      {/* Topic Title */}
                      <Link to={`/${topic.full_path}`} className="block">
                        <h3 className="mt-3 text-lg font-bold text-ink transition group-hover:text-accent dark:text-gray-100 dark:group-hover:text-emerald-400">
                          {topic.title}
                        </h3>
                      </Link>

                      {topic.meta_description && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted dark:text-gray-400">
                          {topic.meta_description}
                        </p>
                      )}

                      {/* Direct Child Topics List */}
                      {childCount > 0 ? (
                        <div className="mt-3 space-y-1 rounded-lg border border-border/60 bg-paper/50 p-2.5 dark:border-gray-800 dark:bg-gray-800/40">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted dark:text-gray-400">
                            sub topics:
                          </p>
                          <ul className="space-y-1 text-xs">
                            {directChildren.map((child) => (
                              <li key={child.id}>
                                <Link
                                  to={`/${child.full_path}`}
                                  className="flex items-center gap-1.5 truncate text-ink/80 transition hover:text-accent dark:text-gray-300 dark:hover:text-emerald-400"
                                >
                                  <ChevronRight className="h-3 w-3 shrink-0 text-muted/60 dark:text-gray-500" />
                                  <span className="truncate">{child.title}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs italic text-muted/60 dark:text-gray-500">
                          No sub topics under this topic yet.
                        </p>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 dark:border-gray-800">
                      <Link
                        to={`/${topic.full_path}`}
                        className="flex items-center gap-1 text-xs font-semibold text-accent transition hover:translate-x-1 dark:text-emerald-400"
                      >
                        <span>Open Topic</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>

                      {isAuthenticated && (
                        <Link
                          to={`/admin/topics/new?parent=${topic.id}`}
                          className="text-[11px] font-medium text-muted hover:text-accent dark:text-gray-400 dark:hover:text-emerald-400"
                          title="Add child page under this topic"
                        >
                          + Add Child Page
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
