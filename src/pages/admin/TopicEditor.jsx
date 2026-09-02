import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
  const [parentOptions, setParentOptions] = useState([]);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    content: '',
    metaDescription: '',
    status: 'draft',
    parentId: searchParams.get('parent') ?? null,
  });
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    getAllTopicsForAdmin().then((tree) => setParentOptions(flattenForSelect(tree)));
  }, []);

  useEffect(() => {
    if (isNew) return;
    getTopicForEdit(id)
      .then((t) => {
        setForm({
          title: t.title,
          slug: t.slug,
          content: t.content,
          metaDescription: t.meta_description ?? '',
          status: t.status,
          parentId: t.parent_id,
        });
        setSlugTouched(true);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleTitleChange = (title) => {
    update({ title, ...(slugTouched ? {} : { slug: slugify(title) }) });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
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
        await updateTopic(id, {
          title: form.title,
          content: form.content,
          meta_description: form.metaDescription,
        });
        if (form.slug !== undefined) {
          // slug/parent changes go through move_topic so the redirect trigger fires consistently
        }
      }
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveOrRename = async () => {
    try {
      await moveTopic(id, form.parentId || null, form.slug);
      alert('Moved / renamed. Old links will redirect automatically.');
    } catch (err) {
      setError(err);
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

  if (loading) return <LoadingState label="Loading topic…" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{isNew ? 'New Topic' : 'Edit Topic'}</h1>
        {!isNew && (
          <button
            onClick={handleTogglePublish}
            className={[
              'rounded-md px-4 py-2 text-sm font-medium',
              form.status === 'published' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800',
            ].join(' ')}
          >
            {form.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error.message}</p>}

      <form onSubmit={handleSave} className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            required
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Slug</label>
          <input
            required
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              update({ slug: slugify(e.target.value) });
            }}
            className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Parent</label>
          <select
            value={form.parentId ?? ''}
            onChange={(e) => update({ parentId: e.target.value || null })}
            className="w-full rounded-md border border-border px-3 py-2"
          >
            <option value="">— Top level —</option>
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
          <label className="mb-1 block text-sm font-medium">Meta description (SEO)</label>
          <input
            value={form.metaDescription}
            onChange={(e) => update({ metaDescription: e.target.value })}
            maxLength={160}
            className="w-full rounded-md border border-border px-3 py-2"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">Content (Markdown, GitHub-flavored)</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <textarea
              value={form.content}
              onChange={(e) => update({ content: e.target.value })}
              rows={20}
              className="w-full rounded-md border border-border p-3 font-mono text-sm"
              placeholder="# Heading&#10;&#10;Write Markdown here…"
            />
            <div className="overflow-auto rounded-md border border-border bg-white p-3">
              <MarkdownRenderer content={form.content} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-light disabled:opacity-60"
          >
            {saving ? 'Saving…' : isNew ? 'Create Topic' : 'Save changes'}
          </button>
          {!isNew && (
            <button
              type="button"
              onClick={handleMoveOrRename}
              className="rounded-md border border-border px-4 py-2 font-medium hover:border-accent-light"
            >
              Apply slug / parent change
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
