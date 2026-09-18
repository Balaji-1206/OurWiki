# Docs Platform

A Markdown documentation CMS: admins manage a nested topic tree with a Markdown
editor; the public reads it at clean URLs like `/system-design/rate-limiter/token-bucket`.

Stack: React + Tailwind (Vercel) · PostgreSQL + Auth + RLS (Supabase).

See **DESIGN.md** for the full architecture write-up (data model, RLS, query
design, security/performance analysis). This file is just setup steps.

## 1. Create the Supabase project

1. Create a project at supabase.com.
2. On a fresh development database, run migrations `0001_init.sql`,
   `0002_wiki_supabase_auth_and_history.sql`, and `0003_admin_only_topic_writes.sql`
   in order, then optionally `supabase/seed.sql`. Do not replay migrations on an
   existing database: migration 0002 changes existing drafts to published.
3. In **Authentication → Providers**, leave Email enabled. There is no public
   sign-up flow in this app. Disable public signup in Supabase Auth and invite
   trusted contributors manually. The current schema permits every authenticated
   user to edit topics; it does not require an admin profile.

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
cp cloudinary.env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from
# Supabase → Project Settings → API. Use the anon/public key — never
# the service_role key.

npm ci
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
preview using the same renderer/sanitizer the public site uses).
New topics currently default to published. The latest checked-in policies allow
public reads of all topics and history, including drafts. Draft status is not an
access-control boundary. This image feature does not change those policies.

## Cloudinary images

### Configuration

1. Use a development Cloudinary environment while testing. Create a **signed**
   upload preset with `allowed_formats` of `jpg,png,webp`, a maximum file size of
   **5242880 bytes (5 MB)**, and no conversion `format`. Do not configure a folder,
   public-ID prefix, incoming transformation, or public-ID override in this preset:
   the server chooses a unique `ourwiki/<user-id>/<uuid>` public ID and the client
   validates the returned identity. Asset-folder organization is optional only if
   it leaves that public ID unchanged.
2. Merge `cloudinary.env.example` into your existing `.env.local` (or `.env`).
   Do not replace existing settings. `SUPABASE_URL` and `SUPABASE_ANON_KEY` use
   the same project and public key as the corresponding `VITE_` settings.
3. Set the Cloudinary cloud name, API key, API secret, and signed preset name.
   Never use a `VITE_` prefix for the API secret or a Supabase service-role key.
4. Optionally set `CLOUDINARY_ALLOWED_USER_IDS` to comma-separated Supabase user
   UUIDs to restrict uploads. Empty means all verified authenticated accounts,
   matching the current contributor model. The endpoint does not trust the
   browser's `isAdmin`, a submitted user ID, or arbitrary upload parameters.

The existing `cloudinary` dependency is server-only. No Cloudinary browser SDK
or database migration is required. Image URLs remain in `topics.content`.

### Run and deploy

`npm run dev` runs only Vite and is sufficient for reading and editing Markdown.
To upload locally, run `npx vercel dev` from the repository and open the URL it
prints. Link a development Vercel project and configure its Development environment
if prompted. The `/api/cloudinary-signature` Vercel function must be available;
an HTML response from that URL indicates incorrect API routing or a Vite-only server.

Set all environment variables in Vercel for the appropriate Preview and Production
environments before deploying; use separate development and production credentials.
The endpoint returns JSON with 405 for GET, 401 for an unauthenticated POST, and
503 if server configuration is missing. Test API routing alongside deep-link SPA
routing in the preview deployment. Keep the existing sitemap endpoint working.

Before opening uploads to a larger contributor group, configure a shared rate
limit at the deployment/API boundary and monitor Cloudinary usage. This initial
implementation does not include a distributed rate limiter. Signatures can be
replayed within Cloudinary's validity window; unique IDs and `overwrite=false`
prevent replacing the same asset, but do not replace quota monitoring.

### Authoring

In the topic editor, put the cursor between paragraphs and choose **Add image**.
Select a PNG, JPEG or WebP up to 5 MB, add descriptive alt text and an optional
caption, then choose **Upload and insert**. Review the preview and save the topic.
The editor preserves the selection and is read-only while the dialog is open.
Escape or Cancel closes the dialog and aborts the browser request without changing
the article. An upload already received by Cloudinary may still remain there.

Images use a width-limited, automatically optimized delivery URL. Check small
diagram labels for readability. Existing external Markdown image links continue
to work. Captions are plain italic Markdown paragraphs; alt text is required for
new uploads. Images are responsive and lazy-loaded, with a white background for
transparent diagrams and a readable fallback when loading fails.

Uploads are public assets. Draft status does not make their URLs private. Removing
Markdown or cancelling a save does not delete the underlying asset: other articles
or historical revisions may still reference it. Review unused uploads manually.

### Validation

Run `npm test` and `npm run build`. Tests cover signature authorization and fixed
parameters, client validation, upload failures and cancellation, Markdown escaping
and insertion, and rendering compatibility. Also check a real upload with a test
account in `vercel dev`, saving/reloading an article, logged-out reading, mobile
layout, dark mode, an expired login, and Cloudinary preset size/type rejection.
