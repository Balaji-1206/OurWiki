-- ============================================================================
-- Migration: 0002_wiki_supabase_auth_and_history.sql
-- Goal:
--   1. Public read access: Anyone can read all pages without signing in.
--   2. Any Supabase authenticated user (created directly in Supabase Auth)
--      can create, edit, move, and delete any topic.
--   3. Audit trail: Track creator, last editor, and store full revision history
--      in public.topic_history.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Alter public.topics to support audit fields and remove strict FK to profiles
-- ----------------------------------------------------------------------------

-- Drop foreign key on created_by referencing profiles if it exists
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'topics_created_by_fkey'
      and table_name = 'topics'
  ) then
    alter table public.topics drop constraint topics_created_by_fkey;
  end if;
end $$;

-- Add created_by FK to auth.users if possible, or leave as uuid
do $$
begin
  alter table public.topics
    add constraint topics_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
exception
  when others then null;
end $$;

-- Add updated_by and email tracking columns to public.topics
alter table public.topics
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists created_by_email text,
  add column if not exists updated_by_email text;

-- Ensure all existing topics are marked as published so they are visible to everyone
update public.topics set status = 'published' where status = 'draft';

-- ----------------------------------------------------------------------------
-- 2. Create public.topic_history table for auditing and revisions
-- ----------------------------------------------------------------------------
create table if not exists public.topic_history (
  id                uuid primary key default gen_random_uuid(),
  topic_id          uuid references public.topics(id) on delete cascade,
  action            text not null check (action in ('created', 'updated', 'moved', 'deleted')),
  title             text not null,
  slug              text not null,
  full_path         text not null,
  content           text,
  meta_description  text,
  status            text,
  modified_by       uuid references auth.users(id) on delete set null,
  modified_by_email text,
  summary           text,
  created_at        timestamptz not null default now()
);

comment on table public.topic_history is
  'Audit log recording every creation, update, move, or deletion of wiki topics.';

create index if not exists topic_history_topic_id_idx on public.topic_history (topic_id);
create index if not exists topic_history_created_at_idx on public.topic_history (created_at desc);

-- ----------------------------------------------------------------------------
-- 3. Automatic Revision Logging & Audit Trigger
-- ----------------------------------------------------------------------------
create or replace function public.log_topic_revision()
returns trigger
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_action text;
begin
  -- Resolve current user ID and email from Supabase auth context
  v_user_id := auth.uid();
  v_user_email := auth.jwt() ->> 'email';

  if (tg_op = 'INSERT') then
    v_action := 'created';
    new.created_by := coalesce(new.created_by, v_user_id);
    new.created_by_email := coalesce(new.created_by_email, v_user_email);
    new.updated_by := coalesce(new.updated_by, v_user_id);
    new.updated_by_email := coalesce(new.updated_by_email, v_user_email);
    new.updated_at := now();

    insert into public.topic_history (
      topic_id, action, title, slug, full_path, content, meta_description, status,
      modified_by, modified_by_email, summary
    ) values (
      new.id, v_action, new.title, new.slug, new.full_path, new.content, new.meta_description, new.status,
      new.updated_by, new.updated_by_email, 'Initial creation'
    );

    return new;

  elsif (tg_op = 'UPDATE') then
    v_action := case
      when old.full_path is distinct from new.full_path then 'moved'
      else 'updated'
    end;

    new.updated_by := coalesce(v_user_id, new.updated_by);
    new.updated_by_email := coalesce(v_user_email, new.updated_by_email);
    new.updated_at := now();

    insert into public.topic_history (
      topic_id, action, title, slug, full_path, content, meta_description, status,
      modified_by, modified_by_email, summary
    ) values (
      new.id, v_action, new.title, new.slug, new.full_path, new.content, new.meta_description, new.status,
      new.updated_by, new.updated_by_email,
      case when v_action = 'moved' then 'Path changed from ' || old.full_path || ' to ' || new.full_path else 'Content / metadata updated' end
    );

    return new;

  elsif (tg_op = 'DELETE') then
    insert into public.topic_history (
      topic_id, action, title, slug, full_path, content, meta_description, status,
      modified_by, modified_by_email, summary
    ) values (
      old.id, 'deleted', old.title, old.slug, old.full_path, null, null, old.status,
      v_user_id, v_user_email, 'Topic deleted'
    );

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_log_topic_revision on public.topics;
create trigger trg_log_topic_revision
before insert or update on public.topics
for each row execute function public.log_topic_revision();

-- ----------------------------------------------------------------------------
-- 4. Update move_topic to allow any authenticated Supabase user
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
  if auth.uid() is null then
    raise exception 'not authorized: please sign in to move topics';
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
      slug = coalesce(p_new_slug, slug),
      updated_by = auth.uid(),
      updated_by_email = auth.jwt() ->> 'email',
      updated_at = now()
  where id = p_topic_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security Policies
-- ----------------------------------------------------------------------------
alter table public.topics enable row level security;
alter table public.topic_history enable row level security;
alter table public.topic_redirects enable row level security;

-- Drop all old policies
drop policy if exists "public_read_published_topics" on public.topics;
drop policy if exists "public_read_all_topics" on public.topics;
drop policy if exists "admin_read_all_topics" on public.topics;
drop policy if exists "admin_insert_topics" on public.topics;
drop policy if exists "admin_update_topics" on public.topics;
drop policy if exists "admin_delete_topics" on public.topics;
drop policy if exists "authenticated_read_all_topics" on public.topics;
drop policy if exists "authenticated_insert_topics" on public.topics;
drop policy if exists "authenticated_update_topics" on public.topics;
drop policy if exists "authenticated_delete_topics" on public.topics;

-- 1) Public unauthenticated read: Anyone can read all topics without sign in
create policy "public_read_all_topics"
  on public.topics for select
  using (true);

-- 2) Any authenticated Supabase user can create topics
create policy "authenticated_insert_topics"
  on public.topics for insert
  to authenticated
  with check (true);

-- 3) Any authenticated Supabase user can update topics
create policy "authenticated_update_topics"
  on public.topics for update
  to authenticated
  using (true)
  with check (true);

-- 4) Any authenticated Supabase user can delete topics
create policy "authenticated_delete_topics"
  on public.topics for delete
  to authenticated
  using (true);

-- History RLS:
drop policy if exists "public_read_topic_history" on public.topic_history;
drop policy if exists "authenticated_all_topic_history" on public.topic_history;

create policy "public_read_topic_history"
  on public.topic_history for select
  using (true);

create policy "authenticated_all_topic_history"
  on public.topic_history for all
  to authenticated
  using (true)
  with check (true);

-- Redirects RLS:
drop policy if exists "public_read_redirects" on public.topic_redirects;
drop policy if exists "authenticated_write_redirects" on public.topic_redirects;

create policy "public_read_redirects"
  on public.topic_redirects for select
  using (true);

create policy "authenticated_write_redirects"
  on public.topic_redirects for all
  to authenticated
  using (true)
  with check (true);
