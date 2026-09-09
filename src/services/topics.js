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

const BASE_PUBLIC_FIELDS =
  'id, parent_id, slug, title, content, full_path, depth, position, meta_description, status, published_at, updated_at, created_at, created_by';

const EXTENDED_PUBLIC_FIELDS =
  'id, parent_id, slug, title, content, full_path, depth, position, meta_description, status, published_at, updated_at, created_at, created_by, updated_by, created_by_email, updated_by_email';

const BASE_NAV_FIELDS =
  'id, parent_id, slug, title, full_path, depth, position, meta_description, updated_at';

const EXTENDED_NAV_FIELDS =
  'id, parent_id, slug, title, full_path, depth, position, meta_description, updated_at, updated_by_email';

/** GET /:path* — resolve a public URL to its page, following redirects. */
export async function getTopicByPath(path) {
  const clean = normalizePath(path);

  let { data, error } = await supabase
    .from('topics')
    .select(EXTENDED_PUBLIC_FIELDS)
    .eq('full_path', clean)
    .maybeSingle();

  if (error && error.code === '42703') {
    const fallback = await supabase
      .from('topics')
      .select(BASE_PUBLIC_FIELDS)
      .eq('full_path', clean)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

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

  let { data: target, error: tErr } = await supabase
    .from('topics')
    .select(EXTENDED_PUBLIC_FIELDS)
    .eq('id', redirect.topic_id)
    .maybeSingle();

  if (tErr && tErr.code === '42703') {
    const fallback = await supabase
      .from('topics')
      .select(BASE_PUBLIC_FIELDS)
      .eq('id', redirect.topic_id)
      .maybeSingle();
    target = fallback.data;
    tErr = fallback.error;
  }

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
    .select('id, slug, title, full_path, position, status, meta_description')
    .eq('parent_id', parent.id)
    .order('position', { ascending: true })
    .order('title', { ascending: true });

  if (error) throw error;
  return data;
}

/** Fetches children, siblings, and parent for a given topic to populate the right rail */
export async function getTopicChildrenAndSiblings(topic) {
  if (!topic?.id) return { children: [], siblings: [], parent: null };

  try {
    // 1. Fetch direct children by parent_id
    const childrenPromise = supabase
      .from('topics')
      .select('id, slug, title, full_path, position, status, meta_description, parent_id')
      .eq('parent_id', topic.id)
      .order('position', { ascending: true })
      .order('title', { ascending: true });

    // 2. Fetch siblings and parent
    let siblingsPromise;
    let parentPromise;

    if (topic.parent_id) {
      siblingsPromise = supabase
        .from('topics')
        .select('id, slug, title, full_path, position, status')
        .eq('parent_id', topic.parent_id)
        .neq('id', topic.id)
        .order('position', { ascending: true })
        .order('title', { ascending: true });

      parentPromise = supabase
        .from('topics')
        .select('id, slug, title, full_path')
        .eq('id', topic.parent_id)
        .maybeSingle();
    } else {
      // Root topic - other root topics are related
      siblingsPromise = supabase
        .from('topics')
        .select('id, slug, title, full_path, position, status')
        .is('parent_id', null)
        .neq('id', topic.id)
        .order('position', { ascending: true })
        .order('title', { ascending: true });

      parentPromise = Promise.resolve({ data: null, error: null });
    }

    const [
      { data: directChildren, error: cErr },
      { data: siblings, error: sErr },
      { data: parent },
    ] = await Promise.all([childrenPromise, siblingsPromise, parentPromise]);

    if (cErr) console.error('Error fetching children:', cErr);
    if (sErr) console.error('Error fetching siblings:', sErr);

    let children = directChildren || [];

    // Fallback: if no direct children found by parent_id, check full_path prefix
    if (children.length === 0 && topic.full_path) {
      const { data: pathChildren } = await supabase
        .from('topics')
        .select('id, slug, title, full_path, position, status, meta_description, parent_id')
        .like('full_path', `${topic.full_path}/%`)
        .order('position', { ascending: true })
        .order('title', { ascending: true });

      if (pathChildren && pathChildren.length > 0) {
        // Immediate child has exactly 1 more segment than parent
        const parentSegmentCount = topic.full_path.split('/').length;
        const immediate = pathChildren.filter((c) => c.full_path.split('/').length === parentSegmentCount + 1);
        children = immediate.length > 0 ? immediate : pathChildren;
      }
    }

    return {
      children,
      siblings: siblings || [],
      parent: parent || null,
    };
  } catch (err) {
    console.error('Error in getTopicChildrenAndSiblings:', err);
    return { children: [], siblings: [], parent: null };
  }
}

/** Fetch revision history for a topic */
export async function getTopicHistory(topicId) {
  if (!topicId) return [];
  try {
    const { data, error } = await supabase
      .from('topic_history')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load topic history:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Error loading history:', err);
    return [];
  }
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

/** The whole topic tree, fetched once and shaped client-side. */
export async function getNavTree() {
  let { data, error } = await supabase
    .from('topics')
    .select(EXTENDED_NAV_FIELDS)
    .order('depth', { ascending: true })
    .order('position', { ascending: true })
    .order('title', { ascending: true });

  if (error && error.code === '42703') {
    const fallback = await supabase
      .from('topics')
      .select(BASE_NAV_FIELDS)
      .order('depth', { ascending: true })
      .order('position', { ascending: true })
      .order('title', { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  return buildTree(data || []);
}

/** Flat list of all topics for instant homepage search */
export async function getAllTopicsFlat() {
  let { data, error } = await supabase
    .from('topics')
    .select(EXTENDED_NAV_FIELDS)
    .order('depth', { ascending: true })
    .order('position', { ascending: true })
    .order('title', { ascending: true });

  if (error && error.code === '42703') {
    const fallback = await supabase
      .from('topics')
      .select(BASE_NAV_FIELDS)
      .order('depth', { ascending: true })
      .order('position', { ascending: true })
      .order('title', { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  return data || [];
}

export function buildTree(flat) {
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
// Mutations: Any authenticated Supabase user can modify data.
// ---------------------------------------------------------------------------

export async function getAllTopicsForAdmin() {
  let { data, error } = await supabase
    .from('topics')
    .select('id, parent_id, slug, title, full_path, depth, position, status, updated_at, published_at, updated_by_email')
    .order('depth', { ascending: true })
    .order('position', { ascending: true })
    .order('title', { ascending: true });

  if (error && error.code === '42703') {
    const fallback = await supabase
      .from('topics')
      .select('id, parent_id, slug, title, full_path, depth, position, status, updated_at, published_at')
      .order('depth', { ascending: true })
      .order('position', { ascending: true })
      .order('title', { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  return buildTree(data || []);
}

export async function getTopicForEdit(id) {
  const { data, error } = await supabase.from('topics').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTopic({ parentId, slug, title, content = '', status = 'published', metaDescription }) {
  const finalSlug = slugify(slug?.trim() || title);
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  const payload = {
    parent_id: parentId ?? null,
    slug: finalSlug,
    title,
    content,
    status,
    meta_description: metaDescription ?? null,
  };

  if (user) {
    payload.created_by = user.id;
    payload.created_by_email = user.email;
    payload.updated_by = user.id;
    payload.updated_by_email = user.email;
  }

  let { data, error } = await supabase
    .from('topics')
    .insert(payload)
    .select()
    .single();

  if (error && error.code === '42703') {
    delete payload.created_by_email;
    delete payload.updated_by;
    delete payload.updated_by_email;
    const retry = await supabase.from('topics').insert(payload).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw translateDbError(error);

  // Backup log if trigger is not yet installed
  try {
    await supabase.from('topic_history').insert({
      topic_id: data.id,
      action: 'created',
      title: data.title,
      slug: data.slug,
      full_path: data.full_path,
      content: data.content,
      modified_by: user?.id,
      modified_by_email: user?.email,
      summary: 'Initial topic creation',
    });
  } catch (_) {}

  return data;
}

export async function updateTopic(id, patch) {
  const payload = { ...patch };
  if (payload.slug !== undefined) {
    payload.slug = slugify(payload.slug?.trim() || '');
  }

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (user) {
    payload.updated_by = user.id;
    payload.updated_by_email = user.email;
  }
  payload.updated_at = new Date().toISOString();

  let { data, error } = await supabase.from('topics').update(payload).eq('id', id).select().single();

  if (error && error.code === '42703') {
    delete payload.updated_by;
    delete payload.updated_by_email;
    const retry = await supabase.from('topics').update(payload).eq('id', id).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw translateDbError(error);

  // Backup log if trigger is not yet installed
  try {
    await supabase.from('topic_history').insert({
      topic_id: data.id,
      action: 'updated',
      title: data.title,
      slug: data.slug,
      full_path: data.full_path,
      content: data.content,
      modified_by: user?.id,
      modified_by_email: user?.email,
      summary: 'Topic content / settings updated',
    });
  } catch (_) {}

  return data;
}

export async function updateTopicPosition(id, position) {
  const { data, error } = await supabase.from('topics').update({ position }).eq('id', id).select().single();
  if (error) throw translateDbError(error);
  return data;
}

export async function reorderTopics(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('topics').update({ position: i }).eq('id', orderedIds[i]);
    if (error) throw translateDbError(error);
  }
}

export async function setPublishStatus(id, status) {
  return updateTopic(id, { status });
}

export async function moveTopic(topicId, newParentId, newSlug) {
  const finalSlug = newSlug ? slugify(newSlug) : null;
  const { error } = await supabase.rpc('move_topic', {
    p_topic_id: topicId,
    p_new_parent_id: newParentId,
    p_new_slug: finalSlug,
  });

  if (!error) return;

  // Resilient fallback if remote DB RPC has not yet been executed
  const { data: topic, error: tErr } = await supabase.from('topics').select('*').eq('id', topicId).single();
  if (tErr) throw tErr;

  const effectiveSlug = finalSlug || topic.slug;
  let newPath = effectiveSlug;
  let newDepth = 0;

  if (newParentId) {
    const { data: parent, error: pErr } = await supabase.from('topics').select('full_path, depth').eq('id', newParentId).single();
    if (pErr) throw pErr;
    newPath = `${parent.full_path}/${effectiveSlug}`;
    newDepth = (parent.depth ?? 0) + 1;
  }

  const oldPath = topic.full_path;

  const { error: uErr } = await supabase
    .from('topics')
    .update({
      parent_id: newParentId,
      slug: effectiveSlug,
      full_path: newPath,
      depth: newDepth,
      updated_at: new Date().toISOString(),
    })
    .eq('id', topicId);

  if (uErr) throw translateDbError(uErr);

  // Update descendants if path changed
  if (oldPath !== newPath) {
    const { data: descendants } = await supabase
      .from('topics')
      .select('id, full_path')
      .like('full_path', `${oldPath}/%`);

    if (descendants?.length) {
      for (const desc of descendants) {
        const descNewPath = desc.full_path.replace(oldPath, newPath);
        const descDepth = descNewPath.split('/').length - 1;
        await supabase
          .from('topics')
          .update({
            full_path: descNewPath,
            depth: descDepth,
          })
          .eq('id', desc.id);
      }
    }

    try {
      await supabase.from('topic_redirects').insert({
        topic_id: topicId,
        old_path: oldPath,
      });
    } catch (_) {}
  }
}

export async function countSubtree(fullPath) {
  const { data, error } = await supabase.rpc('count_subtree', { p_full_path: fullPath });
  if (error) throw error;
  return data;
}

export async function deleteTopic(id) {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  // Best effort log before deleting
  try {
    const { data: topic } = await supabase.from('topics').select('title, slug, full_path, status').eq('id', id).maybeSingle();
    if (topic) {
      await supabase.from('topic_history').insert({
        topic_id: id,
        action: 'deleted',
        title: topic.title,
        slug: topic.slug,
        full_path: topic.full_path,
        status: topic.status,
        modified_by: user?.id,
        modified_by_email: user?.email,
        summary: 'Topic deleted',
      });
    }
  } catch (_) {}

  const { error } = await supabase.from('topics').delete().eq('id', id);
  if (error) throw translateDbError(error);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function normalizePath(path) {
  return (path || '').replace(/^\/+|\/+$/g, '');
}

export function slugify(input) {
  if (!input) return '';
  return input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function translateDbError(error) {
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
