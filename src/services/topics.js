import { supabase } from '../lib/supabaseClient';

/**
 * All Supabase access for "topics" lives here. Components never call
 * supabase.from('topics') directly — that keeps the query shapes (and the
 * assumptions baked into them, like "public reads are always filtered to
 * published") in one auditable place.
 *
 * Every mutation relies on Postgres RLS to actually enforce who can do what;
 * these functions do not themselves grant any privilege. A logged-out user
 * calling createTopic() will simply get a 403 back from Postgres.
 */

const PUBLIC_FIELDS =
  'id, parent_id, slug, title, content, full_path, depth, meta_description, status, published_at, updated_at';

/** GET /:path* — resolve a public URL to its page, following redirects. */
export async function getTopicByPath(path) {
  const clean = normalizePath(path);

  const { data, error } = await supabase
    .from('topics')
    .select(PUBLIC_FIELDS)
    .eq('full_path', clean)
    .maybeSingle();

  if (error) throw error;
  if (data) return { topic: data, redirectedFrom: null };

  // Not found at that path — maybe it moved or was renamed.
  const { data: redirect, error: rErr } = await supabase
    .from('topic_redirects')
    .select('topic_id')
    .eq('old_path', clean)
    .maybeSingle();

  if (rErr) throw rErr;
  if (!redirect) return { topic: null, redirectedFrom: null };

  const { data: target, error: tErr } = await supabase
    .from('topics')
    .select(PUBLIC_FIELDS)
    .eq('id', redirect.topic_id)
    .maybeSingle();

  if (tErr) throw tErr;
  return { topic: target, redirectedFrom: clean };
}

/** Direct children of a path (used for admin tree expansion; the public
 *  sidebar instead uses getNavTree() to avoid one query per level). */
export async function getTopicChildren(path) {
  const { data: parent, error: pErr } = await supabase
    .from('topics')
    .select('id')
    .eq('full_path', normalizePath(path))
    .maybeSingle();
  if (pErr) throw pErr;
  if (!parent) return [];

  const { data, error } = await supabase
    .from('topics')
    .select('id, slug, title, full_path, position, status')
    .eq('parent_id', parent.id)
    .order('position', { ascending: true })
    .order('title', { ascending: true });

  if (error) throw error;
  return data;
}

/** Breadcrumbs for a path: one indexed IN-query, no recursion needed since
 *  full_path already gives us every ancestor's exact path. */
export async function getTopicBreadcrumbs(path) {
  const clean = normalizePath(path);
  const segments = clean.split('/');
  const prefixes = segments.map((_, i) => segments.slice(0, i + 1).join('/'));

  const { data, error } = await supabase
    .from('topics')
    .select('id, title, full_path')
    .in('full_path', prefixes);

  if (error) throw error;
  return data.sort((a, b) => a.full_path.length - b.full_path.length);
}

/** The whole published tree, fetched once and shaped client-side. Docs sites
 *  rarely exceed a few thousand nodes, so one flat query + in-memory nesting
 *  beats N sidebar round-trips. Callers should cache this (see useNavTree). */
export async function getNavTree() {
  const { data, error } = await supabase
    .from('topics')
    .select('id, parent_id, slug, title, full_path, depth, position')
    .eq('status', 'published')
    .order('depth', { ascending: true })
    .order('position', { ascending: true })
    .order('title', { ascending: true });

  if (error) throw error;
  return buildTree(data);
}

function buildTree(flat) {
  const byId = new Map(flat.map((n) => [n.id, { ...n, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Full-text search over published content. */
export async function searchTopics(query) {
  if (!query?.trim()) return [];
  const { data, error } = await supabase.rpc('search_topics', { q: query });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Admin-only mutations. RLS rejects these outright for non-admins; the try/
// catch at the call site is what surfaces that as a friendly UI message.
// ---------------------------------------------------------------------------

export async function getAllTopicsForAdmin() {
  const { data, error } = await supabase
    .from('topics')
    .select('id, parent_id, slug, title, full_path, depth, position, status, updated_at, published_at')
    .order('depth', { ascending: true })
    .order('position', { ascending: true });
  if (error) throw error;
  return buildTree(data);
}

export async function getTopicForEdit(id) {
  const { data, error } = await supabase.from('topics').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTopic({ parentId, slug, title, content = '', status = 'draft', metaDescription }) {
  const { data, error } = await supabase
    .from('topics')
    .insert({
      parent_id: parentId ?? null,
      slug: slugify(slug ?? title),
      title,
      content,
      status,
      meta_description: metaDescription ?? null,
    })
    .select()
    .single();

  if (error) throw translateDbError(error);
  return data;
}

export async function updateTopic(id, patch) {
  const payload = { ...patch };
  if (payload.slug) payload.slug = slugify(payload.slug);

  const { data, error } = await supabase.from('topics').update(payload).eq('id', id).select().single();
  if (error) throw translateDbError(error);
  return data;
}

export async function setPublishStatus(id, status) {
  return updateTopic(id, { status });
}

export async function moveTopic(topicId, newParentId, newSlug) {
  const { error } = await supabase.rpc('move_topic', {
    p_topic_id: topicId,
    p_new_parent_id: newParentId,
    p_new_slug: newSlug ?? null,
  });
  if (error) throw translateDbError(error);
}

export async function countSubtree(fullPath) {
  const { data, error } = await supabase.rpc('count_subtree', { p_full_path: fullPath });
  if (error) throw error;
  return data;
}

export async function deleteTopic(id) {
  // Deleting a parent cascades to all descendants at the DB level (FK
  // on delete cascade). The admin UI must call countSubtree() first and get
  // explicit confirmation before calling this — see TopicEditor.jsx.
  const { error } = await supabase.from('topics').delete().eq('id', id);
  if (error) throw translateDbError(error);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePath(path) {
  return path.replace(/^\/+|\/+$/g, '');
}

export function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function translateDbError(error) {
  if (error.code === '23505') {
    return new Error('A topic with this slug already exists under the same parent.');
  }
  if (error.code === '23503') {
    return new Error('That parent topic no longer exists.');
  }
  if (error.code === '42501' || error.message?.toLowerCase().includes('not authorized')) {
    return new Error('You do not have permission to perform this action.');
  }
  return error;
}
