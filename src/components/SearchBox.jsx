import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  ArrowRight,
  X,
  Command,
  Plus,
  FolderKanban,
  BookOpen,
  Sun,
  Moon,
  FolderTree,
  Sparkles,
} from 'lucide-react';
import { searchTopics, getAllTopicsFlat } from '../services/topics';

function HighlightedSnippet({ snippet, query }) {
  if (!snippet) return null;

  // If snippet contains <b>...</b> from PostgreSQL ts_headline
  if (snippet.includes('<b>')) {
    const parts = snippet.split(/(<b>.*?<\/b>)/gi);
    return (
      <span className="text-xs text-muted dark:text-gray-300">
        {parts.map((part, i) => {
          if (part.startsWith('<b>') && part.endsWith('</b>')) {
            return (
              <mark
                key={i}
                className="rounded bg-yellow-200 px-0.5 font-semibold text-ink dark:bg-yellow-500/30 dark:text-yellow-200"
              >
                {part.slice(3, -4)}
              </mark>
            );
          }
          return part;
        })}
      </span>
    );
  }

  // Otherwise highlight query in plain text
  if (!query?.trim()) return <span className="text-xs text-muted dark:text-gray-400">{snippet}</span>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = snippet.split(regex);

  return (
    <span className="text-xs text-muted dark:text-gray-300">
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

export default function SearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [allTopics, setAllTopics] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  // Load all flat topics once for instant local fallback search
  useEffect(() => {
    if (open && allTopics.length === 0) {
      getAllTopicsFlat().then(setAllTopics).catch(() => {});
    }
  }, [open, allTopics.length]);

  // Global keyboard listener for Ctrl+K, Cmd+K, or "/"
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === '/' && !open && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Theme toggle helper
  const handleToggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setOpen(false);
  };

  // Quick Action Commands when query is empty
  const quickActions = useMemo(
    () => [
      {
        id: 'qa-new-topic',
        title: 'Create New Topic',
        subtitle: 'Add a new parent category or subpage',
        icon: Plus,
        category: 'Quick Action',
        action: () => navigate('/admin/topics/new'),
      },
      {
        id: 'qa-studio',
        title: 'Wiki Studio',
        subtitle: 'Manage topics, publishing, and hierarchy',
        icon: FolderKanban,
        category: 'Quick Action',
        action: () => navigate('/admin'),
      },
      {
        id: 'qa-home',
        title: 'Browse All Documentation',
        subtitle: 'Return to knowledge base home',
        icon: BookOpen,
        category: 'Quick Action',
        action: () => navigate('/'),
      },
      {
        id: 'qa-theme',
        title: 'Toggle Dark / Light Theme',
        subtitle: 'Switch between light and dark mode',
        icon: Sun,
        category: 'System',
        action: handleToggleTheme,
      },
    ],
    [navigate]
  );

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      searchTopics(query)
        .then((dbResults) => {
          if (dbResults && dbResults.length > 0) {
            setResults(dbResults);
          } else {
            // Local fallback match across title, slug, and path
            const q = query.toLowerCase().trim();
            const matched = allTopics
              .filter(
                (t) =>
                  t.title.toLowerCase().includes(q) ||
                  t.full_path.toLowerCase().includes(q) ||
                  (t.meta_description && t.meta_description.toLowerCase().includes(q))
              )
              .map((t) => ({
                ...t,
                snippet: t.meta_description || `Documentation page at /${t.full_path}`,
              }));
            setResults(matched);
          }
          setSelectedIndex(0);
        })
        .catch(() => {
          // Local fallback match
          const q = query.toLowerCase().trim();
          const matched = allTopics
            .filter((t) => t.title.toLowerCase().includes(q) || t.full_path.toLowerCase().includes(q))
            .map((t) => ({
              ...t,
              snippet: t.meta_description || `Documentation page at /${t.full_path}`,
            }));
          setResults(matched);
          setSelectedIndex(0);
        })
        .finally(() => setLoading(false));
    }, 180);

    return () => clearTimeout(timer);
  }, [query, allTopics]);

  // Current list of items to display
  const isActionView = !query.trim();
  const currentItems = isActionView ? quickActions : results;

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && currentItems.length > 0) {
      const activeEl = listRef.current.children[selectedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, currentItems]);

  const handleSelectItem = (item) => {
    setOpen(false);
    if (item.action) {
      item.action();
    } else if (item.full_path) {
      navigate(`/${item.full_path}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (currentItems.length > 0 ? (prev + 1) % currentItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (currentItems.length > 0 ? (prev - 1 + currentItems.length) % currentItems.length : 0));
    } else if (e.key === 'Enter' && currentItems[selectedIndex]) {
      e.preventDefault();
      handleSelectItem(currentItems[selectedIndex]);
    }
  };

  return (
    <>
      {/* Trigger Button in Header */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-1.5 text-xs text-muted shadow-xs transition hover:border-accent hover:text-ink dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-emerald-500 dark:hover:text-white"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5 text-accent dark:text-emerald-400" />
        <span className="hidden sm:inline">Search docs or jump to...</span>
        <span className="sm:hidden">Search</span>
        <kbd className="hidden rounded-md border border-border bg-paper/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted sm:inline-block dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
          Ctrl K
        </kbd>
      </button>

      {/* Command Palette Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/5 p-4 pt-16 backdrop-blur-xs transition-opacity sm:pt-24 dark:bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-white shadow-2xl transition-all dark:border-gray-700 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input Header */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 dark:border-gray-800">
              <Search className="h-5 w-5 text-accent dark:text-emerald-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search topics, paths, or type a command..."
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted dark:text-gray-100 dark:placeholder:text-gray-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="rounded-md p-1 text-muted hover:text-ink dark:hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <kbd className="rounded-md border border-border bg-paper px-1.5 py-0.5 font-mono text-[11px] text-muted dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                ESC
              </kbd>
            </div>

            {/* Results / Quick Actions List */}
            <div className="max-h-96 overflow-y-auto no-scrollbar p-2">
              {loading ? (
                <div className="py-8 text-center text-xs text-muted dark:text-gray-400">
                  <div className="mx-auto mb-2 h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent dark:border-emerald-400" />
                  <span>Searching documentation...</span>
                </div>
              ) : isActionView ? (
                /* Quick Actions view */
                <div>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted dark:text-gray-400">
                    Quick Commands
                  </div>
                  <ul ref={listRef} className="space-y-1">
                    {quickActions.map((action, idx) => {
                      const isSelected = idx === selectedIndex;
                      const Icon = action.icon;
                      return (
                        <li
                          key={action.id}
                          onClick={() => handleSelectItem(action)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition ${
                            isSelected
                              ? 'bg-accent/10 text-accent dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'hover:bg-black/5 dark:hover:bg-gray-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                              isSelected ? 'bg-accent text-white dark:bg-emerald-600' : 'bg-paper dark:bg-gray-800 text-muted'
                            }`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-ink dark:text-white">{action.title}</p>
                              <p className="text-[11px] text-muted dark:text-gray-400">{action.subtitle}</p>
                            </div>
                          </div>
                          <ArrowRight className={`h-3.5 w-3.5 transition ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : results.length > 0 ? (
                /* Search Results View */
                <div>
                  <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted dark:text-gray-400">
                    <span>Matching Pages ({results.length})</span>
                    <span>Use ↑ ↓ to navigate</span>
                  </div>
                  <ul ref={listRef} className="space-y-1.5">
                    {results.map((item, idx) => {
                      const isSelected = idx === selectedIndex;
                      const isChild = item.full_path?.includes('/');

                      return (
                        <li
                          key={item.id}
                          onClick={() => handleSelectItem(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 transition ${
                            isSelected
                              ? 'bg-accent/10 text-accent dark:bg-emerald-950/50 dark:text-emerald-300 ring-1 ring-accent/30 dark:ring-emerald-500/30'
                              : 'hover:bg-black/5 dark:hover:bg-gray-800/60'
                          }`}
                        >
                          <FileText
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                              isChild ? 'text-emerald-500' : 'text-accent dark:text-emerald-400'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 truncate">
                                <span className="truncate text-xs font-bold text-ink dark:text-white">
                                  {item.title}
                                </span>
                                <span
                                  className={`rounded-md px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                                    isChild
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                                  }`}
                                >
                                  {isChild ? 'Child Page' : 'Parent'}
                                </span>
                              </div>
                              <span className="shrink-0 font-mono text-[10px] text-muted dark:text-gray-400">
                                /{item.full_path}
                              </span>
                            </div>

                            {/* Snippet Preview with Keyword Highlighting */}
                            {item.snippet && (
                              <div className="mt-1 line-clamp-2 rounded-md bg-paper/50 p-1.5 text-[11px] dark:bg-gray-800/50">
                                <HighlightedSnippet snippet={item.snippet} query={query} />
                              </div>
                            )}
                          </div>
                          <ArrowRight
                            className={`h-4 w-4 shrink-0 self-center transition ${
                              isSelected ? 'opacity-100 text-accent dark:text-emerald-400' : 'opacity-0'
                            }`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted dark:text-gray-400">
                  <p>No results found for &ldquo;<span className="font-semibold text-ink dark:text-white">{query}</span>&rdquo;</p>
                  <p className="mt-1 text-xs">Try searching for other topic names, content, or clear the search.</p>
                </div>
              )}
            </div>

            {/* Footer Navigation Hints */}
            <div className="flex items-center justify-between border-t border-border bg-paper/60 px-4 py-2 text-[11px] text-muted dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="rounded border border-border bg-white px-1 font-mono text-[10px] dark:border-gray-700 dark:bg-gray-800">↵</kbd> Select
                </span>
                <span>
                  <kbd className="rounded border border-border bg-white px-1 font-mono text-[10px] dark:border-gray-700 dark:bg-gray-800">↑↓</kbd> Navigate
                </span>
                <span>
                  <kbd className="rounded border border-border bg-white px-1 font-mono text-[10px] dark:border-gray-700 dark:bg-gray-800">esc</kbd> Close
                </span>
              </div>
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="h-3 w-3 text-accent dark:text-emerald-400" />
                <span>Command Palette</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
