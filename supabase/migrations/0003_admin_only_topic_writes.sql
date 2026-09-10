-- ============================================================================
-- Migration: 0003_authenticated_topic_writes.sql
-- Goal:
--   Make the live Supabase schema match the intended application rules:
--   - everyone can read published content without signing in
--   - any authenticated Supabase user can write topics, topic history, and redirects
-- ============================================================================

alter table public.topics enable row level security;
alter table public.topic_history enable row level security;
alter table public.topic_redirects enable row level security;

-- Topic policies: public reads, authenticated writes

drop policy if exists "public_read_published_topics" on public.topics;
drop policy if exists "public_read_all_topics" on public.topics;
drop policy if exists "admin_read_all_topics" on public.topics;
drop policy if exists "admin_insert_topics" on public.topics;
drop policy if exists "admin_update_topics" on public.topics;
drop policy if exists "admin_delete_topics" on public.topics;
drop policy if exists "authenticated_insert_topics" on public.topics;
drop policy if exists "authenticated_update_topics" on public.topics;
drop policy if exists "authenticated_delete_topics" on public.topics;

create policy "public_read_all_topics"
  on public.topics for select
  using (true);

create policy "authenticated_insert_topics"
  on public.topics for insert
  to authenticated
  with check (true);

create policy "authenticated_update_topics"
  on public.topics for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_delete_topics"
  on public.topics for delete
  to authenticated
  using (true);

-- History policies: public can read, authenticated users can write

drop policy if exists "public_read_topic_history" on public.topic_history;
drop policy if exists "authenticated_all_topic_history" on public.topic_history;
drop policy if exists "admin_all_topic_history" on public.topic_history;

create policy "public_read_topic_history"
  on public.topic_history for select
  using (true);

create policy "authenticated_all_topic_history"
  on public.topic_history for all
  to authenticated
  using (true)
  with check (true);

-- Redirect policies: public can read, authenticated users can write

drop policy if exists "public_read_redirects" on public.topic_redirects;
drop policy if exists "authenticated_write_redirects" on public.topic_redirects;
drop policy if exists "admin_write_redirects" on public.topic_redirects;

create policy "public_read_redirects"
  on public.topic_redirects for select
  using (true);

create policy "authenticated_write_redirects"
  on public.topic_redirects for all
  to authenticated
  using (true)
  with check (true);
