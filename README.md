# Docs Platform

A Markdown documentation CMS: admins manage a nested topic tree with a Markdown
editor; the public reads it at clean URLs like `/system-design/rate-limiter/token-bucket`.

Stack: React + Tailwind (Vercel) · PostgreSQL + Auth + RLS (Supabase).

See **DESIGN.md** for the full architecture write-up (data model, RLS, query
design, security/performance analysis). This file is just setup steps.

## 1. Create the Supabase project

1. Create a project at supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_init.sql` (schema, triggers,
   RLS policies), then optionally `supabase/seed.sql` (sample content).
3. In **Authentication → Providers**, leave Email enabled. There is no public
   sign-up flow in this app — admins are created manually (below).

## 2. Create the first admin (the "owner")

1. In **Authentication → Users**, invite/create a user with your own email.
2. In the SQL editor:
   ```sql
   insert into public.profiles (id, role, display_name)
   values ('<paste the user id from the Users tab>', 'owner', 'Site Owner');
   ```
3. That account can now sign in at `/login` and reach `/admin`.

Additional admins: for the MVP, an owner runs the same `insert into profiles`
statement (with `role = 'admin'`) for each teammate after inviting them from
the Supabase dashboard. A self-serve "invite admin" button is a natural
Phase-2 addition — see DESIGN.md's scalability section.

## 3. Configure the frontend

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from
# Supabase → Project Settings → API. Use the anon/public key — never
# the service_role key.

npm install
npm run dev
```

## 4. Deploy

- **Vercel**: import the repo, set `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` as environment variables, plus (for the sitemap
  function) `SUPABASE_URL` and `SUPABASE_ANON_KEY` (same values, without the
  `VITE_` prefix, since that prefix only exists for Vite's client build).
- `vercel.json` rewrites all paths to `index.html` so client-side routing
  handles deep links like `/system-design/rate-limiter` on a hard refresh.
- In Supabase → Authentication → URL Configuration, add your Vercel domain
  to the allowed redirect URLs.

## Project structure

```
src/
├── components/     Sidebar, Breadcrumbs, MarkdownRenderer, search, states
├── contexts/       AuthContext (Supabase Auth session + profile/role)
├── hooks/          useNavTree (cached published tree)
├── layouts/        PublicLayout
├── pages/          HomePage, DocPage, LoginPage, NotFoundPage, admin/*
├── services/       topics.js — the only place that talks to Supabase
└── App.jsx         Routes

supabase/
├── migrations/0001_init.sql   Schema, triggers, functions, RLS
└── seed.sql                   Sample topic tree

api/sitemap.xml.js             Vercel serverless function, serves live sitemap
```

## Editing content

Admin → a topic → **Edit** opens a two-pane Markdown editor (source + live
preview using the same renderer/sanitizer the public site uses). Publishing
is a separate explicit action from saving, so drafts never leak publicly —
enforced by RLS, not just by the UI hiding a button.
