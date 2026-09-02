-- ============================================================================
-- Documentation Platform — Initial Schema
-- Model: adjacency list (parent_id) is the source of truth for hierarchy.
-- full_path is a denormalized, trigger-maintained materialized path used as
-- the public URL and as the primary lookup key. See DESIGN.md for the
-- rationale (ltree/parent_id/materialized-path tradeoffs) before editing this.
-- ============================================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- profiles: one row per admin/owner. Public readers never need a row here.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'admin' check (role in ('owner', 'admin')),
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Admin/owner accounts only. The Supabase project owner promotes rows to role=owner manually once, then owners create admins from the app.';

-- ----------------------------------------------------------------------------
-- topics: single self-referencing table for the entire hierarchy, at any depth.
-- ----------------------------------------------------------------------------
create table public.topics (
  id                uuid primary key default gen_random_uuid(),
  parent_id         uuid references public.topics(id) on delete cascade,
  slug              text not null,
  title             text not null,
  content           text not null default '',
  full_path         text not null,               -- e.g. 'system-design/rate-limiter/token-bucket'
  depth             int  not null default 0,
  position          int  not null default 0,     -- sibling display order
  status            text not null default 'draft' check (status in ('draft', 'published')),
  meta_description  text,
  search_vector     tsvector generated always as (
                       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('english', coalesce(content, '')), 'B')
                     ) stored,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz,

  constraint slug_format    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint no_self_parent check (parent_id is distinct from id)
);

comment on column public.topics.full_path is
  'Denormalized path of slugs joined by "/". Recomputed by trigger whenever slug or parent_id changes, and cascaded to all descendants. This — not id — is the public URL.';
comment on column public.topics.position is
  'Manual sibling ordering for drag-and-drop reordering in the admin UI.';

-- Sibling slugs must be unique under the same parent (partial indexes handle
-- root topics, whose parent_id is null, separately from PostgreSQL's NULL
-- equality semantics).
create unique index topics_unique_slug_per_parent
  on public.topics (parent_id, slug) where parent_id is not null;
create unique index topics_unique_root_slug
  on public.topics (slug) where parent_id is null;

-- The single most important index: every public page load resolves by this.
create unique index topics_unique_full_path on public.topics (full_path);
-- Prefix search ("all descendants of X") for moves/deletes/counts.
create index topics_full_path_prefix_idx on public.topics (full_path text_pattern_ops);
-- Tree/children/reparent lookups.
create index topics_parent_id_idx on public.topics (parent_id);
-- Public listing/nav-tree queries always filter by status.
create index topics_status_idx on public.topics (status);
-- Full-text search.
create index topics_search_idx on public.topics using gin (search_vector);

-- ----------------------------------------------------------------------------
-- topic_redirects: old_path -> topic_id, populated automatically whenever a
-- topic is renamed or moved, so old links never 404.
-- ----------------------------------------------------------------------------
create table public.topic_redirects (
  old_path   text primary key,
  topic_id   uuid not null references public.topics(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Invariant: a redirect should never point at a path that is currently live.
-- This can't be expressed as a CHECK constraint (Postgres rejects subqueries
-- inside CHECK — that's the exact error this note used to trigger). Instead
-- it's guaranteed by construction: topics_cascade_path_update() only ever
-- inserts a row's *former* full_path, at the same instant that path stops
-- being live, and application reads (getTopicByPath) always try the topics
-- table first, falling back to topic_redirects only on a miss.

create index topic_redirects_topic_id_idx on public.topic_redirects (topic_id);

-- ----------------------------------------------------------------------------
-- is_admin(): the single source of truth for "may write to topics".
-- SECURITY DEFINER so it can read profiles regardless of the caller's RLS,
-- without opening profiles itself up to public reads.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'owner')
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  );
$$;

-- ----------------------------------------------------------------------------
-- Trigger: compute full_path / depth / timestamps on every insert or on
-- update of slug / parent_id / status.
-- ----------------------------------------------------------------------------
create or replace function public.topics_set_path()
returns trigger
language plpgsql
as $$
declare
  parent_path  text;
  parent_depth int;
begin
  if new.parent_id is null then
    new.full_path := new.slug;
    new.depth := 0;
  else
    select full_path, depth into parent_path, parent_depth
    from public.topics where id = new.parent_id;

    if parent_path is null then
      raise exception 'Invalid parent_id: % (no such topic)', new.parent_id;
    end if;

    new.full_path := parent_path || '/' || new.slug;
    new.depth := parent_depth + 1;
  end if;

  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or new.published_at is null) then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;

  return new;
end;
$$;

create trigger trg_topics_set_path
before insert or update of slug, parent_id, status on public.topics
for each row execute function public.topics_set_path();

-- ----------------------------------------------------------------------------
-- Trigger: when full_path actually changes (rename or move), cascade the new
-- prefix to every descendant and record a redirect for every path that just
-- stopped being live (the node itself, and each affected descendant).
-- ----------------------------------------------------------------------------
create or replace function public.topics_cascade_path_update()
returns trigger
language plpgsql
as $$
begin
  if old.full_path is distinct from new.full_path then

    insert into public.topic_redirects (old_path, topic_id)
    values (old.full_path, new.id)
    on conflict (old_path) do update set topic_id = excluded.topic_id;

    with descendants as (
      update public.topics
      set full_path = new.full_path || substring(full_path from length(old.full_path) + 1),
          depth     = depth - old.depth + new.depth,
          updated_at = now()
      where full_path like old.full_path || '/%'
      returning id, full_path as new_full_path
    )
    insert into public.topic_redirects (old_path, topic_id)
    select old.full_path || substring(d.new_full_path from length(new.full_path) + 1), d.id
    from descendants d
    on conflict (old_path) do update set topic_id = excluded.topic_id;

  end if;
  return new;
end;
$$;

create trigger trg_topics_cascade_path
after update of full_path on public.topics
for each row execute function public.topics_cascade_path_update();

-- ----------------------------------------------------------------------------
-- move_topic: convenience RPC used by the admin UI's "move" action. Doing the
-- reparent through a function (rather than a raw UPDATE) gives us one place
-- to add validation later (e.g. "cannot move a node into its own subtree").
-- ----------------------------------------------------------------------------
create or replace function public.move_topic(p_topic_id uuid, p_new_parent_id uuid, p_new_slug text default null)
returns void
language plpgsql
security invoker
as $$
declare
  v_new_parent_path text;
  v_old_path        text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_new_parent_id is not null then
    select full_path into v_new_parent_path from public.topics where id = p_new_parent_id;
    select full_path into v_old_path from public.topics where id = p_topic_id;
    if v_new_parent_path like v_old_path || '/%' or v_new_parent_path = v_old_path then
      raise exception 'Cannot move a topic into its own subtree';
    end if;
  end if;

  update public.topics
  set parent_id = p_new_parent_id,
      slug = coalesce(p_new_slug, slug)
  where id = p_topic_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- count_subtree: lets the admin UI show "this will delete 4 pages" before a
-- destructive delete, rather than deleting blind.
-- ----------------------------------------------------------------------------
create or replace function public.count_subtree(p_full_path text)
returns int
language sql
stable
as $$
  select count(*)::int from public.topics
  where full_path = p_full_path or full_path like p_full_path || '/%';
$$;

-- ----------------------------------------------------------------------------
-- search_topics: full-text search over published content only.
-- ----------------------------------------------------------------------------
create or replace function public.search_topics(q text)
returns table (id uuid, title text, full_path text, rank real, snippet text)
language sql
stable
as $$
  select
    t.id,
    t.title,
    t.full_path,
    ts_rank(t.search_vector, websearch_to_tsquery('english', q)) as rank,
    ts_headline('english', t.content, websearch_to_tsquery('english', q),
                'MaxFragments=1,MaxWords=24,MinWords=8') as snippet
  from public.topics t
  where t.status = 'published'
    and t.search_vector @@ websearch_to_tsquery('english', q)
  order by rank desc
  limit 20;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.topics enable row level security;
alter table public.profiles enable row level security;
alter table public.topic_redirects enable row level security;

-- topics: public reads published rows; admins read/write everything.
create policy "public_read_published_topics"
  on public.topics for select
  using (status = 'published');

create policy "admin_read_all_topics"
  on public.topics for select
  using (public.is_admin());

create policy "admin_insert_topics"
  on public.topics for insert
  with check (public.is_admin());

create policy "admin_update_topics"
  on public.topics for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin_delete_topics"
  on public.topics for delete
  using (public.is_admin());

-- profiles: a user always reads their own row; owners read/manage everyone.
create policy "read_own_profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "owner_read_all_profiles"
  on public.profiles for select
  using (public.is_owner());

create policy "owner_manage_profiles"
  on public.profiles for all
  using (public.is_owner())
  with check (public.is_owner());

-- redirects: public needs to read these to resolve moved/renamed URLs.
-- Writes only ever happen via the trigger (executes as table owner, bypasses RLS).
create policy "public_read_redirects"
  on public.topic_redirects for select
  using (true);

-- ============================================================================
-- Bootstrapping the first owner (run once, manually, after the project
-- owner signs up through Supabase Auth):
--
--   insert into public.profiles (id, role, display_name)
--   values ('<their auth.users.id>', 'owner', 'Site Owner');
--
-- From then on, owners create additional admins from the Admin UI, which
-- calls supabase.auth.admin.inviteUserByEmail (via an Edge Function using
-- the service role key — never from the browser) and inserts a matching
-- profiles row with role='admin'.
-- ============================================================================
