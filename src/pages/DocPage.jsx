import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Clock,
  Calendar,
  AlignLeft,
  ArrowUp,
  Edit,
  Plus,
  History,
  FolderTree,
  ChevronRight,
  User,
  CheckCircle,
  X,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Helmet } from './helmet-lite';
import { getTopicByPath, slugify, getTopicChildrenAndSiblings, getTopicHistory } from '../services/topics';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumbs from '../components/Breadcrumbs';
import MarkdownRenderer from '../components/MarkdownRenderer';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import NotFoundPage from './NotFoundPage';

function extractHeadings(content) {
  if (!content) return [];
  const lines = content.split('\n');
  const headings = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim().replace(/[*`_\[\]]/g, '');
      const id = slugify(text);
      if (id) {
        headings.push({ level, text, id });
      }
    }
  }
  return headings;
}

export default function DocPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.replace(/^\/+/, '');
  const { isAuthenticated, userEmail } = useAuth();

  const [state, setState] = useState({ status: 'loading', topic: null, error: null });
  const [activeHeading, setActiveHeading] = useState('');
  const [relatedData, setRelatedData] = useState({ children: [], siblings: [], parent: null });
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load topic by path
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', topic: null, error: null });

    getTopicByPath(path)
      .then(({ topic, redirectedFrom }) => {
        if (cancelled) return;
        if (redirectedFrom) {
          navigate(`/${topic.full_path}`, { replace: true });
          return;
        }
        if (!topic) {
          setState({ status: 'not-found', topic: null, error: null });
          return;
        }
        setState({ status: 'ready', topic, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', topic: null, error });
      });

    return () => {
      cancelled = true;
    };
  }, [path, navigate]);

  // When topic is loaded, fetch related topics (children and siblings)
  useEffect(() => {
    if (!state.topic?.id) return;
    let cancelled = false;

    getTopicChildrenAndSiblings(state.topic).then((res) => {
      if (!cancelled) {
        setRelatedData(res);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [state.topic?.id, state.topic?.parent_id]);

  // Load history when history modal is opened
  const handleOpenHistory = async () => {
    if (!state.topic?.id) return;
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const logs = await getTopicHistory(state.topic.id);
      setHistoryLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const headings = useMemo(() => {
    return extractHeadings(state.topic?.content || '');
  }, [state.topic?.content]);

  // Scrollspy observer for headings
  useEffect(() => {
    if (headings.length === 0) return;

    const handleScroll = () => {
      const headingElements = headings
        .map((h) => document.getElementById(h.id))
        .filter(Boolean);

      const scrollPos = window.scrollY + 120;
      for (let i = headingElements.length - 1; i >= 0; i--) {
        const el = headingElements[i];
        if (el && el.offsetTop <= scrollPos) {
          setActiveHeading(el.id);
          return;
        }
      }
      if (headingElements[0]) {
        setActiveHeading(headingElements[0].id);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  if (state.status === 'loading') return <LoadingState label="Loading page…" />;
  if (state.status === 'not-found') return <NotFoundPage />;
  if (state.status === 'error') {
    return (
      <ErrorState
        title="Couldn't load this page"
        message={state.error?.message ?? 'A database error occurred.'}
        onRetry={() => navigate(0)}
      />
    );
  }

  const { topic } = state;
  const canonicalUrl = `${window.location.origin}/${topic.full_path}`;

  // Reading stats
  const wordCount = topic.content ? topic.content.trim().split(/\s+/).filter(Boolean).length : 0;
  const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
  const updatedDate = topic.updated_at
    ? new Date(topic.updated_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const modifiedByDisplay = topic.updated_by_email || topic.created_by_email || 'Author';

  return (
    <div className="flex flex-col gap-10 lg:flex-row">
      {/* ====================================================================
          LEFT COLUMN: Primary Article Content
      ==================================================================== */}
      <article className="min-w-0 flex-1">
        <Helmet
          title={`${topic.title} · Docs`}
          description={topic.meta_description ?? topic.content.slice(0, 155)}
          canonical={canonicalUrl}
        />

        <Breadcrumbs path={topic.full_path} />

        {/* Title and Metadata Header */}
        <header className="mb-8 border-b border-border pb-6 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl dark:text-white">
              {topic.title}
            </h1>

            {/* Quick Action Button in Header */}
            {isAuthenticated ? (
              <Link
                to={`/admin/topics/${topic.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-white dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white"
                title="Edit this topic in Wiki Studio"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Edit this page</span>
              </Link>
            ) : (
              <Link
                to="/login"
                state={{ from: `/${topic.full_path}` }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent hover:text-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                title="Sign in to edit this page"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Sign in to edit</span>
              </Link>
            )}
          </div>

          {/* Metadata pill row */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted dark:text-gray-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle className="h-3 w-3" />
              <span>Published</span>
            </span>

            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{readTimeMinutes} min read ({wordCount} words)</span>
            </span>

            {updatedDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>Updated {updatedDate}</span>
              </span>
            )}

            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-muted/70" />
              <span>Last edited by <strong className="font-medium text-ink dark:text-gray-200">{modifiedByDisplay}</strong></span>
            </span>

            <button
              type="button"
              onClick={handleOpenHistory}
              className="flex items-center gap-1 text-accent hover:underline dark:text-emerald-400"
              title="View revision history recorded in database"
            >
              <History className="h-3.5 w-3.5" />
              <span>View History</span>
            </button>
          </div>
        </header>

        {/* Markdown Body */}
        <MarkdownRenderer content={topic.content} />

        {/* End of article content */}
      </article>

      {/* ====================================================================
          RIGHT COLUMN: Child links, Related links, Table of Contents & Audit
      ==================================================================== */}
      <aside className="hidden w-64 shrink-0 lg:block xl:w-72">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-6 overflow-y-auto no-scrollbar pl-2 pr-1 text-xs">
          {/* Child Topics Section (Direct Subpages) */}
          <div className="rounded-xl border border-border/80 bg-white p-3.5 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink dark:text-gray-200">
                <FolderTree className="h-3.5 w-3.5 text-accent dark:text-emerald-400" />
                <span>Child Pages</span>
                {relatedData.children?.length > 0 && (
                  <span className="ml-1 rounded-full bg-accent/10 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-accent dark:bg-emerald-950/60 dark:text-emerald-400">
                    {relatedData.children.length}
                  </span>
                )}
              </span>

              {isAuthenticated && (
                <Link
                  to={`/admin/topics/new?parent=${topic.id}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-accent transition hover:underline dark:text-emerald-400"
                  title="Add child page under this topic"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add page</span>
                </Link>
              )}
            </div>

            {relatedData.children?.length > 0 ? (
              <ul className="space-y-1">
                {relatedData.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      to={`/${child.full_path}`}
                      className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-ink/80 transition hover:bg-black/5 hover:text-accent dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-emerald-400"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate font-medium">{child.title}</span>
                        {child.status === 'draft' && (
                          <span className="rounded bg-amber-100 px-1 py-0.2 text-[8px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            draft
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted/50 transition group-hover:translate-x-0.5 group-hover:text-accent dark:text-gray-500 dark:group-hover:text-emerald-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-2 text-center text-muted dark:text-gray-500">
                <p className="text-[11px]">No subpages under this topic yet.</p>
                {isAuthenticated && (
                  <Link
                    to={`/admin/topics/new?parent=${topic.id}`}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline dark:text-emerald-400"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Create first child page</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* 3. Related / Sibling Topics */}
          {relatedData.siblings?.length > 0 && (
            <div className="rounded-xl border border-border/80 bg-white p-3.5 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
              <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink dark:text-gray-200">
                <Layers className="h-3.5 w-3.5 text-muted" />
                <span>
                  {relatedData.parent ? `Related in ${relatedData.parent.title}` : 'Related Categories'}
                </span>
              </div>
              <ul className="space-y-1">
                {relatedData.siblings.slice(0, 6).map((sibling) => (
                  <li key={sibling.id}>
                    <Link
                      to={`/${sibling.full_path}`}
                      className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-ink/75 transition hover:bg-black/5 hover:text-accent dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-emerald-400"
                    >
                      <span className="truncate">{sibling.title}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 4. Table of Contents (On this page) */}
          {headings.length > 0 && (
            <div>
              <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted dark:text-gray-400">
                <AlignLeft className="h-3.5 w-3.5" />
                <span>On this page</span>
              </div>
              <ul className="space-y-1 border-l border-border/80 pl-2.5 dark:border-gray-800">
                {headings.map((h, idx) => {
                  const isActive = activeHeading === h.id;
                  return (
                    <li
                      key={idx}
                      style={{ paddingLeft: h.level === 3 ? '8px' : '0px' }}
                    >
                      <a
                        href={`#${h.id}`}
                        className={`block truncate transition ${
                          isActive
                            ? 'font-semibold text-accent dark:text-emerald-400'
                            : 'text-muted hover:text-ink dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                      >
                        {h.text}
                      </a>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-4 flex items-center gap-1 text-[11px] text-muted transition hover:text-ink dark:text-gray-500 dark:hover:text-gray-300"
              >
                <ArrowUp className="h-3 w-3" />
                <span>Back to top</span>
              </button>
            </div>
          )}

          {/* 5. Revision & DB Audit Note */}
          <div className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted dark:border-gray-800 dark:text-gray-400">
            <div className="flex items-center gap-1.5 font-semibold text-ink dark:text-gray-300">
              <History className="h-3.5 w-3.5 text-accent dark:text-emerald-400" />
              <span>DB Audit &amp; History</span>
            </div>
            <p className="mt-1">
              Edits are automatically noted in database.
            </p>
            <button
              type="button"
              onClick={handleOpenHistory}
              className="mt-2 inline-flex items-center gap-1 text-accent hover:underline dark:text-emerald-400 font-medium"
            >
              <span>View full revision log</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </aside>

      {/* ====================================================================
          REVISION HISTORY MODAL (DB AUDIT TRAIL)
      ==================================================================== */}
      {historyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 p-4 backdrop-blur-xs transition-opacity dark:bg-black/50"
          onClick={() => setHistoryModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-4 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-accent dark:text-emerald-400" />
                <h3 className="text-base font-bold text-ink dark:text-white">
                  Revision History &amp; DB Audit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto no-scrollbar pr-1">
              <p className="mb-3 text-xs text-muted dark:text-gray-400">
                Tracking all user modifications for <strong>{topic.title}</strong>:
              </p>

              {loadingHistory ? (
                <LoadingState label="Loading database revision log..." />
              ) : historyLogs.length === 0 ? (
                <div className="rounded-xl border border-border/80 bg-paper/60 p-4 text-center text-xs text-muted dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                  <p className="font-semibold text-ink dark:text-gray-200">Current Live Version</p>
                  <p className="mt-1">Last edited by: <strong>{modifiedByDisplay}</strong></p>
                  <p className="mt-0.5">Updated at: {updatedDate || 'Recently'}</p>
                  <p className="mt-2 text-[11px] text-muted/80">
                    Detailed per-stroke history will record on subsequent edits via Supabase triggers.
                  </p>
                </div>
              ) : (
                <div className="relative border-l-2 border-border/80 pl-4 ml-2 space-y-4 dark:border-gray-800">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent dark:bg-emerald-500" />

                      <div className="rounded-lg border border-border/70 bg-paper/40 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent dark:bg-emerald-950/60 dark:text-emerald-400">
                            {log.action}
                          </span>
                          <span className="text-[11px] text-muted dark:text-gray-400">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>

                        <p className="mt-1.5 text-xs text-ink/90 dark:text-gray-200">
                          {log.summary || 'Topic updated'}
                        </p>

                        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted dark:text-gray-400">
                          <User className="h-3 w-3" />
                          <span>Modified by: <strong className="text-ink dark:text-gray-300">{log.modified_by_email || 'Authenticated User'}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-border pt-3 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-ink transition hover:bg-black/5 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
