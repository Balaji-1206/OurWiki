import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Bold,
  Italic,
  Code,
  Link as LinkIcon,
  Heading2,
  Quote,
  Table as TableIcon,
  Save,
  Check,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import {
  getTopicForEdit,
  createTopic,
  updateTopic,
  setPublishStatus,
  moveTopic,
  getAllTopicsForAdmin,
  slugify,
} from '../../services/topics';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import LoadingState from '../../components/LoadingState';

function flattenForSelect(tree, depth = 0, out = []) {
  for (const n of tree) {
    out.push({ id: n.id, label: `${'— '.repeat(depth)}${n.title}` });
    flattenForSelect(n.children ?? [], depth + 1, out);
  }
  return out;
}

export default function TopicEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [parentOptions, setParentOptions] = useState([]);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    content: '',
    metaDescription: '',
    status: 'published',
    parentId: searchParams.get('parent') ?? null,
  });

  const [initialStructure, setInitialStructure] = useState({ slug: '', parentId: null, full_path: '' });
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    getAllTopicsForAdmin().then((tree) => setParentOptions(flattenForSelect(tree)));
  }, []);

  useEffect(() => {
    if (isNew) return;
    getTopicForEdit(id)
      .then((t) => {
        const initial = {
          title: t.title,
          slug: t.slug,
          content: t.content,
          metaDescription: t.meta_description ?? '',
          status: t.status,
          parentId: t.parent_id,
        };
        setForm(initial);
        setInitialStructure({ slug: t.slug, parentId: t.parent_id, full_path: t.full_path });
        setSlugTouched(true);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleTitleChange = (title) => {
    update({ title, ...(slugTouched ? {} : { slug: slugify(title) }) });
  };

  const isStructureChanged =
    !isNew &&
    (form.slug !== initialStructure.slug ||
      (form.parentId || null) !== (initialStructure.parentId || null));

  const insertMarkdown = (prefix, suffix = '', defaultText = '') => {
    const textarea = document.getElementById('markdown-editor-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end) || defaultText;
    const replacement = `${prefix}${selected}${suffix}`;

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    update({ content: newContent });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 10);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isNew) {
        const created = await createTopic({
          parentId: form.parentId || null,
          slug: form.slug,
          title: form.title,
          content: form.content,
          status: form.status,
          metaDescription: form.metaDescription,
        });
        navigate(`/admin/topics/${created.id}`, { replace: true });
      } else {
        // If slug or parent changed, apply structural move
        if (isStructureChanged) {
          await moveTopic(id, form.parentId || null, form.slug);
          setInitialStructure((prev) => ({ ...prev, slug: form.slug, parentId: form.parentId || null }));
        }

        // Update content and metadata
        const updated = await updateTopic(id, {
          title: form.title,
          content: form.content,
          meta_description: form.metaDescription,
          status: form.status,
        });

        if (updated) {
          setInitialStructure((prev) => ({ ...prev, full_path: updated.full_path }));
        }

        setSuccessMessage('Topic saved and revision recorded in database successfully.');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    const next = form.status === 'published' ? 'draft' : 'published';
    try {
      await setPublishStatus(id, next);
      update({ status: next });
    } catch (err) {
      setError(err);
    }
  };

  if (loading) return <LoadingState label="Loading topic..." />;

  const words = form.content ? form.content.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="max-w-6xl">
      {/* Top Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 text-xs text-muted hover:text-ink dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Topics</span>
          </button>
          <span className="text-muted/40 dark:text-gray-600">/</span>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">
            {isNew ? 'New Topic' : 'Edit Topic'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && initialStructure.full_path && (
            <Link
              to={`/${initialStructure.full_path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-ink dark:border-gray-700 dark:text-gray-300 dark:hover:text-white"
            >
              <span>View Live Page</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}

          {!isNew && (
            <button
              type="button"
              onClick={handleTogglePublish}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition ${
                form.status === 'published'
                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:hover:bg-amber-900'
                  : 'bg-green-100 text-green-900 hover:bg-green-200 dark:bg-green-950/70 dark:text-green-300 dark:hover:bg-green-900'
              }`}
            >
              {form.status === 'published' ? 'Unpublish to Draft' : 'Publish to Live'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error.message}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {isStructureChanged && (
        <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            You have modified the slug or parent hierarchy. Saving will automatically update descendant URLs and create redirects for existing links.
          </span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Topic Metadata Grid */}
        <div className="grid gap-4 rounded-xl border border-border bg-white p-5 shadow-sm sm:grid-cols-2 dark:border-gray-800 dark:bg-gray-900/50">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted dark:text-gray-400">
              Title
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Rate Limiter"
              className="w-full rounded-lg border border-border bg-paper/50 px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted dark:text-gray-400">
              URL Slug
            </label>
            <input
              required
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                update({ slug: slugify(e.target.value) });
              }}
              placeholder="e.g. rate-limiter"
              className="w-full rounded-lg border border-border bg-paper/50 px-3.5 py-2 font-mono text-sm outline-none transition focus:border-accent focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted dark:text-gray-400">
              Parent Topic
            </label>
            <select
              value={form.parentId ?? ''}
              onChange={(e) => update({ parentId: e.target.value || null })}
              className="w-full rounded-lg border border-border bg-paper/50 px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
            >
              <option value="">— Top Level Topic (No Parent) —</option>
              {parentOptions
                .filter((o) => o.id !== id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted dark:text-gray-400">
              Meta Description (SEO)
            </label>
            <input
              value={form.metaDescription}
              onChange={(e) => update({ metaDescription: e.target.value })}
              maxLength={160}
              placeholder="Brief summary for search engines and social cards..."
              className="w-full rounded-lg border border-border bg-paper/50 px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Content Split Editor */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
          {/* Formatting Toolbar */}
          <div className="flex flex-wrap items-center justify-between border-b border-border bg-paper/60 px-4 py-2 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => insertMarkdown('**', '**', 'bold text')}
                className="rounded p-1.5 text-muted transition hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('*', '*', 'italic text')}
                className="rounded p-1.5 text-muted transition hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                title="Italic"
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('## ', '', 'Heading 2')}
                className="rounded p-1.5 text-muted transition hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                title="Heading 2"
              >
                <Heading2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('`', '`', 'inline code')}
                className="rounded p-1.5 text-muted transition hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                title="Inline Code"
              >
                <Code className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('> ', '', 'Quoted text')}
                className="rounded p-1.5 text-muted transition hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                title="Blockquote"
              >
                <Quote className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('[', '](https://example.com)', 'Link text')}
                className="rounded p-1.5 text-muted transition hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                title="Insert Link"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  insertMarkdown(
                    '| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |\n'
                  )
                }
                className="rounded p-1.5 text-muted transition hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                title="Insert Table"
              >
                <TableIcon className="h-4 w-4" />
              </button>
            </div>

            <span className="text-xs text-muted dark:text-gray-500">
              {words} words · {form.content.length} characters
            </span>
          </div>

          {/* Side-by-side Editor & Live Preview */}
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-gray-800">
            <textarea
              id="markdown-editor-textarea"
              value={form.content}
              onChange={(e) => update({ content: e.target.value })}
              rows={22}
              placeholder="# Heading&#10;&#10;Write Markdown documentation here..."
              className="w-full resize-y bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none dark:text-gray-100"
            />
            <div className="max-h-[550px] overflow-y-auto no-scrollbar bg-paper/30 p-5 dark:bg-gray-900/40">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted dark:text-gray-500">
                Live Reader Preview
              </div>
              <MarkdownRenderer content={form.content} />
            </div>
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-light disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving changes...' : isNew ? 'Create Topic' : 'Save All Changes'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:border-accent-light hover:text-ink dark:border-gray-700 dark:text-gray-400 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
