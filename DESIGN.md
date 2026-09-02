# Design Document

## 1. High-level architecture

```
Browser (React SPA, Tailwind)
   │  supabase-js, anon key only
   ▼
Supabase Auth  ──────────────►  PostgreSQL  ◄────── Row Level Security
   │                                 ▲
   ▼                                 │
Vercel (static hosting + CDN     Vercel Serverless Function
 + one serverless function)      (/api/sitemap.xml — read-only, anon key)
```

The frontend talks **directly** to Supabase (Postgres via PostgREST + Auth).
There is no separate backend API server. See §12 for why.

## 2. Hierarchical data model — the core decision

Four options were evaluated for the topic tree:

| Approach | Query performance | Storage | Simplicity | Deep nesting | Moving subtrees | Supabase fit |
|---|---|---|---|---|---|---|
| **Separate tables per level** (topics/subtopics/subsubtopics) | fine, but N tables to union for any cross-level query | wasteful, duplicated schema | poor — hierarchy depth is hardcoded into the schema | **impossible past the hardcoded depth** | different code path per level | poor |
| **Adjacency list only** (`parent_id`, no path) | children/parent: O(1) index lookup. Full path or breadcrumbs: recursive walk per request | minimal | simple | unlimited | trivial — update one row | good |
| **`ltree` extension** | very fast ancestor/descendant queries via GiST index; native `<@`/`@>` operators | small | extra extension + mental model to learn | unlimited | needs path rewrite on move (same cost as materialized path) | supported by Supabase, but **ltree labels only allow letters/digits/underscore — no hyphens**, which collides directly with URL-safe hyphenated slugs (`rate-limiter`). Workarounds (re-encoding hyphens) add complexity for a benefit this app doesn't need. |
| **Adjacency list + materialized path** (chosen) | page lookup: O(1) unique-index equality scan on `full_path`. Children: index scan on `parent_id`. Breadcrumbs: one indexed `IN` query (no recursion). Tree: one query + in-memory nesting | one extra text column | one trigger to maintain it; otherwise plain SQL | unlimited | rewrite `full_path` for the node + descendants (one `UPDATE ... WHERE full_path LIKE 'old/%'`), done inside a trigger, invisible to callers | first-class Postgres, no extensions |

**Decision:** `parent_id` is the relational source of truth (it's what
foreign keys, cascading deletes, and "move" operations act on). `full_path`
is a **denormalized, trigger-maintained** materialized path used purely as
a fast lookup key and as the public URL. This gives ltree-like read
performance without the extension, the hyphen incompatibility, or an
unfamiliar operator set — at the cost of one plpgsql trigger, implemented
once in the migration and never touched by application code.

Rejected: pure adjacency list without a path column, because every public
page load would need a recursive walk from root just to answer "what's the
content at `/system-design/rate-limiter`", and breadcrumbs would need a
second recursive walk upward. Denormalizing the path trades a small amount
of write-time complexity (one trigger) for O(1) reads on the single most
frequent query in the app.

### Storing vs. computing the full path

**Stored, not computed on read.** The alternative — computing the full path
by walking `parent_id` on every request — makes the single hottest query
(page-by-URL) the most expensive one. Storing it costs one extra `text`
column and a trigger; it's the right trade given the read:write ratio of a
docs site (read constantly, write occasionally).

## 3. URL / path strategy

- Public URLs are `full_path` values, never `id`s — IDs are UUIDs and stay
  entirely internal (foreign keys, edit links in the admin UI, React keys).
  This satisfies "avoid relying on database IDs as public URLs" and means
  IDs stay stable across renames/moves.
- Slugs are auto-derived from the title (`slugify()` in `services/topics.js`,
  mirrored by the DB `slug_format` CHECK constraint: lowercase,
  alphanumeric, single hyphens), editable afterward.
- Sibling slug uniqueness is enforced by a **partial unique index** on
  `(parent_id, slug)` — partial because Postgres treats `NULL = NULL` as
  unknown, so root-level topics (`parent_id IS NULL`) need their own unique
  index on `slug` alone.
- **Renames and moves never break old links.** A trigger
  (`topics_cascade_path_update`) fires whenever `full_path` changes (because
  `slug` or `parent_id` changed), rewrites `full_path` for every descendant,
  and inserts a row into `topic_redirects` for every path that just stopped
  being live. `DocPage.jsx` tries `topics` first, then `topic_redirects`, and
  does a client-side `replace` navigation to the new URL — the address bar
  updates and the old URL is never left as a dead end.

## 4. Authentication & authorization

- **Authentication**: Supabase Auth, email/password. No public sign-up route
  exists in the app — the project owner creates the first "owner" profile
  directly in SQL after inviting themselves via the Supabase dashboard;
  after that, owners create admins the same way (see README).
- **Authorization**: enforced entirely by **Postgres RLS**, not by frontend
  `if (user.isAdmin)` checks. Concretely:
  - `public.is_admin()` / `public.is_owner()` are `SECURITY DEFINER` SQL
    functions that check the `profiles` table regardless of the caller's own
    RLS visibility into `profiles`.
  - `topics` SELECT: `status = 'published'` (open to everyone, including
    anonymous) **OR** `is_admin()`.
  - `topics` INSERT/UPDATE/DELETE: `is_admin()` only.
  - `profiles` SELECT: a user sees their own row; owners see everyone.
    Writes to `profiles` (creating/changing roles): owners only.
  - `topic_redirects` SELECT: public (needed to resolve moved URLs);
    written only by the trigger, which runs with table-owner privileges and
    is therefore unaffected by RLS.
- The React `ProtectedRoute` / `AuthContext.isAdmin` checks are explicitly
  documented in code as **UX-only**: they stop the admin shell from
  flashing on screen for a logged-out visitor, but grant nothing. A user who
  bypasses them entirely (e.g., calls Supabase directly from devtools) gets
  a Postgres `42501` permission error, not data — verified against every
  mutation in `services/topics.js`.

## 5. Database schema

See `supabase/migrations/0001_init.sql` for the authoritative version. Summary:

**`profiles`** — one row per admin/owner (never per public reader). Exists
because Supabase's own `auth.users` table can't hold app-specific role data,
and because RLS policies need something to check that isn't controllable by
the end user.

**`topics`** — the single hierarchical table (no `subtopics`/`subsubtopics`
tables — see §2).

| Column | Why it exists |
|---|---|
| `id uuid` | stable internal identity; survives renames/moves |
| `parent_id uuid → topics.id` | the actual hierarchy; `ON DELETE CASCADE` so deleting a node deletes its subtree (see §13 for why that's safe) |
| `slug` | this node's own URL segment |
| `title` | display name; also seeds the auto-generated slug |
| `content` | the Markdown source — Postgres is the single source of truth for content |
| `full_path` | denormalized public URL / lookup key (§2) |
| `depth` | avoids recomputing depth from `full_path` when ordering the nav tree |
| `position` | manual sibling ordering (drag-and-drop reordering target) |
| `status` | `draft`/`published` — the entire public/private boundary |
| `meta_description` | SEO; optional, falls back to a content excerpt |
| `search_vector` | generated `tsvector` column, weighted title > content, for full-text search |
| `created_by → profiles.id` | authorship; `ON DELETE SET NULL` so removing an admin never deletes their content |
| `created_at`/`updated_at`/`published_at` | audit trail and ordering |

**`topic_redirects`** — `old_path → topic_id`. Exists solely so renames/moves
don't 404 old links (§3). Kept as its own tiny table rather than a JSON
column on `topics` because it needs its own primary key (`old_path`) and its
own index for O(1) lookups on the 404 path.

Deliberately **not** built for the MVP (see §19/§22 for how to add later
without a redesign): content versioning table, tags/categories, comments,
per-page view analytics, multi-language content. None of these were asked
for, and each adds a table or column doing nothing until a real requirement
shows up (constraint #12: design for scalability, don't build it now).

**IDs**: UUID (`gen_random_uuid()`), not `bigint`. UUIDs are safe to
generate client-side or in import scripts without coordinating with a DB
sequence, and — more importantly — the public URL is `full_path`, not `id`,
so the usual "short sequential ID for a clean URL" argument doesn't apply.

## 6. ER diagram

```
auth.users (Supabase-managed)
      │ 1
      │
      │ 1
public.profiles
  id, role, display_name
      │ 1
      │ created_by (nullable)
      │ *
public.topics ───────────────┐
  id, parent_id, slug,       │ parent_id (self-FK, ON DELETE CASCADE)
  title, content, full_path, │
  status, ...                │
      ▲───────────────────────┘
      │ * topic_id
      │
public.topic_redirects
  old_path (PK), topic_id, created_at
```

- `profiles.id` = `auth.users.id` (1:1, not a separate identity).
- `topics.parent_id → topics.id`: self-referencing, unlimited depth, cascade
  delete (a node's entire subtree is deleted with it — see §13).
- `topics.created_by → profiles.id`: nullable, `SET NULL` on admin removal.
- `topic_redirects.topic_id → topics.id`: cascade delete.

## 7. Required indexes

| Index | Query it serves | Notes |
|---|---|---|
| `UNIQUE (full_path)` | **the** public page lookup — every `GET /:path*` | single most important index in the schema |
| `(full_path text_pattern_ops)` | `WHERE full_path LIKE 'prefix/%'` — subtree moves, `count_subtree`, cascade trigger | `text_pattern_ops` makes prefix `LIKE` sargable |
| `UNIQUE (parent_id, slug) WHERE parent_id IS NOT NULL` | prevents duplicate sibling slugs; also serves "children of X" | partial index — see §3 |
| `UNIQUE (slug) WHERE parent_id IS NULL` | same, for root-level topics | |
| `(parent_id)` | children-of / admin tree building, and `parent_id IS NULL` root queries | |
| `(status)` | every public query filters `status = 'published'` | |
| `GIN (search_vector)` | full-text search | required for `@@` to use an index |

Not created: a bare index on `created_at`/`updated_at` — nothing queries
"all topics after date X" independent of status or parent, so it would cost
write overhead for no read benefit. Add `(status, updated_at desc)` if an
activity feed is added later.

## 8. Key queries

**Get a public page** (`GET /system-design/rate-limiter`):
```sql
select id, parent_id, title, slug, content, full_path, meta_description, updated_at
from topics
where full_path = 'system-design/rate-limiter' and status = 'published';
```
Single equality lookup on the unique `full_path` index.

**Resolve a moved/renamed URL** (fallback when the above returns nothing):
```sql
select t.full_path
from topic_redirects r join topics t on t.id = r.topic_id
where r.old_path = 'system-design/rate-limiter/token-bucket';
```

**Children of a topic:**
```sql
select id, slug, title, full_path, position
from topics
where parent_id = (select id from topics where full_path = 'system-design')
  and status = 'published'
order by position, title;
```

**Parent of a topic:**
```sql
select p.id, p.title, p.full_path
from topics t join topics p on p.id = t.parent_id
where t.full_path = 'system-design/rate-limiter';
```

**Full nav tree** (published only, fetched once, nested in-memory):
```sql
select id, parent_id, slug, title, full_path, depth, position
from topics
where status = 'published'
order by depth, position, title;
```
Rejected: a recursive CTE per request — unnecessary for a tree that's
realistically hundreds to low-thousands of rows and cached client-side for
the session (`useNavTree`).

**Breadcrumbs** (`/system-design/rate-limiter/token-bucket`):
```sql
select id, title, full_path from topics
where full_path = any(array[
  'system-design',
  'system-design/rate-limiter',
  'system-design/rate-limiter/token-bucket'
]);
```
The prefix array is computed client-side from the current path — no
recursive parent-walk needed, because `full_path` already encodes every
ancestor's exact path.

**Search** (wrapped as the `search_topics()` RPC):
```sql
select id, title, full_path, ts_rank(search_vector, q) as rank,
       ts_headline('english', content, q, 'MaxFragments=1,MaxWords=24') as snippet
from topics, websearch_to_tsquery('english', 'token bucket') q
where status = 'published' and search_vector @@ q
order by rank desc limit 20;
```

## 9. React architecture

```
src/
├── components/   presentational + data-fetching leaf components
├── contexts/     AuthContext — the only global state (Supabase session)
├── hooks/        useNavTree — module-level cache of the published tree
├── layouts/      PublicLayout (header/sidebar/search chrome)
├── pages/        one file per route, admin/ for the protected subtree
├── services/     topics.js — the ONLY file that imports supabase for topics
├── lib/          supabaseClient.js — the one client instance
└── App.jsx       routes
```

`services/topics.js` is a deliberate choke point: no component calls
`supabase.from('topics')` directly, so the query shapes are auditable in
one file and the transport (e.g. swapping to Edge Functions later) could
change without touching any component.

No global state library — the only cross-cutting state is the auth
session, which fits in one React Context. Adding Redux/Zustand for this
app's actual state shape would be over-engineering (constraint #12).

## 10. Admin UI

`/admin` → tree view (`AdminDashboard.jsx`) with inline **+ Child / Edit /
Delete** actions per node, sourced from `getAllTopicsForAdmin()` (same
`buildTree()` helper as the public nav, but unfiltered — RLS, not a query
flag, is what makes that safe as an admin).

`/admin/topics/new` and `/admin/topics/:id` → `TopicEditor.jsx`: a two-pane
form — `<textarea>` Markdown source on the left, the **same**
`MarkdownRenderer` used publicly on the right, so an admin's preview is
exactly what a reader sees. Publish/unpublish is a distinct, explicit
action from saving content, so an edit is never accidentally made public.
Slug/parent changes go through a separate "Apply slug / parent change"
action calling `move_topic()`, kept distinct from the main save so
rename/move (which triggers the redirect cascade) is deliberate, not a
side effect of every save.

Reordering uses a `position` integer already queried with `ORDER BY
position`; drag-and-drop UI for setting it is an additive Phase-2 frontend
change, no backend change required.

## 11. Public UI

`PublicLayout` (header with logo/search/sign-in, collapsible sidebar on
mobile) wraps `HomePage` (top-level topic grid) and `DocPage` (breadcrumbs
→ title → rendered Markdown → prev/next). `DocPage` owns the
loading/not-found/error states so every documentation URL behaves
consistently, including ones that don't exist.

## 12. Data access layer: direct Supabase, not a custom backend

Three options considered:

1. **Direct Supabase access from the frontend (chosen).** RLS at the
   database is the actual security boundary regardless of which option is
   picked, so a bespoke API layer would just re-implement checks Postgres
   already enforces. supabase-js talks straight to PostgREST + Auth.
2. **Supabase Edge Functions** for every operation — justified when logic
   needs elevated (service-role) privilege or third-party calls. This app
   needs that in exactly one place: inviting a new admin requires
   `auth.admin.inviteUserByEmail`, which needs the service-role key and
   must run server-side. That's the right Phase-2 candidate for an Edge
   Function; everything else (topic CRUD, search) has no such requirement.
3. **A separate backend API** (Node/Express) — rejected: it would just
   proxy to Postgres under the same RLS, adding a service to deploy/scale/
   secure for no functional gain (violates constraint #1).

The one operation that genuinely needs service-role privilege (inviting
admins) is explicitly called out in the README as **not yet implemented**
client-side — precisely because it must not be — rather than taking a
shortcut through the browser.

## 13. Security review

- **XSS**: Markdown renders through `react-markdown` with
  `rehype-sanitize` (an explicit allow-list schema), stripping `<script>`,
  event-handler attributes, `javascript:` URLs, and any raw HTML in the
  source — including HTML pasted into the admin editor. `rehype-highlight`
  runs before sanitize so its `className`s are allow-listed rather than
  stripped, and sanitize still runs last so nothing either plugin
  introduces goes unchecked.
- **SQL injection**: not applicable in the direct-Supabase model —
  PostgREST parameterizes all filters; the only raw SQL is inside
  migration-defined functions (`search_topics`, `move_topic`,
  `count_subtree`), which take typed parameters and never concatenate
  input into SQL strings.
- **Authorization**: DB-enforced via RLS (§4), traced against every
  mutation in `services/topics.js`.
- **Public access boundary**: a single column (`status`) and a single
  policy predicate (`status = 'published'`) is the entire public/private
  boundary, kept in one place to audit rather than spread across flags.
- **Slug manipulation**: normalized client-side (`slugify()`) and
  re-validated at the DB with `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` —
  a malformed direct API call still can't insert path traversal, uppercase,
  unicode homoglyphs, or empty slugs.
- **Delete operations**: `parent_id` uses `ON DELETE CASCADE`, so deleting
  a node deletes its whole subtree at the DB level — intentional (a
  section without its parent doesn't make sense standalone), but the admin
  UI never deletes blind: it calls `count_subtree()` first and shows
  "this will delete N pages" before the destructive call. The cascade
  itself isn't reversible in this MVP — §22 covers adding soft-delete
  later without a redesign.
- **Draft leakage**: blocked by RLS regardless of frontend behavior; the
  frontend additionally never requests admin-only fields on public routes.

## 14. Performance analysis

Expected scale: a documentation site — hundreds to low-thousands of pages,
read-heavy, low write volume, no reason to expect traffic spikes beyond
normal CDN-servable levels.

- **Page load**: one indexed-equality query per page (§8). The nav tree is
  fetched once per session and cached in-memory (`useNavTree`), so
  navigating between pages costs one query (the page itself), not one
  query per sidebar level.
- **CDN**: Vercel serves built static assets from its edge network with no
  extra configuration. The sitemap function sets
  `Cache-Control: s-maxage=3600` so the edge caches it for an hour instead
  of re-querying Supabase per crawler hit.
- **Is a cache layer (Redis) needed? No** — explicitly evaluated and
  rejected. Every hot-path query is a single indexed lookup, which
  comfortably outperforms what a docs site will demand; adding Redis would
  introduce a second data store to keep consistent for zero measured need
  (constraint #9). If Supabase's connection pool or latency ever becomes
  the bottleneck, the first lever is Supabase's built-in pooling/read
  replicas, before an external cache.
- **Query minimization**: `DocPage` issues one topic query plus one
  breadcrumb query (both single indexed lookups); nothing N+1s across the
  sidebar or prev/next (both computed from the already-cached nav tree).

## 15. SEO

**Constraint acknowledged up front**: this is a client-rendered React SPA.
`document.title`/`<meta>` tags set in `useEffect` (`pages/helmet-lite.jsx`)
are invisible to crawlers that don't execute JavaScript, and even for ones
that do (Googlebot renders JS, but on a delay; not every crawler or
social-media unfurler does), this is strictly weaker than server-rendered
HTML carrying the right tags in the initial response.

**Implemented within the requested React/Vercel stack**: dynamic
`document.title`, meta description, canonical link, and Open Graph tags per
page (client-set); semantic HTML (`<article>`, heading hierarchy matching
the Markdown's own levels, `aria-label`led nav for breadcrumbs/sidebar); a
live `sitemap.xml` (Vercel serverless function, §14) and `robots.txt`
pointing to it.

**Honest recommendation, not silently applied**: if organic ranking is
actually a priority, the better-suited framework is **Next.js** (or another
SSR/SSG React framework), so crawlers and link-preview bots get fully
rendered HTML — including correct `<title>`/OG tags — in the first
response, no JS execution required. This is flagged as a real
architectural trade-off for the brief to decide on explicitly, rather than
swapped in silently. The MVP stays on plain React + Vite per the stated
stack; porting later is a frontend-only change, since `services/topics.js`
is plain async functions a Next server component could call directly.

## 16. Deployment

- **Env vars (frontend)**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` —
  anon key only, ever. The service_role key lives only in the Supabase
  dashboard and is never set in Vercel or committed anywhere.
- **Env vars (sitemap function)**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` —
  same values, unprefixed since Vercel serverless functions don't go
  through Vite's `import.meta.env` substitution.
- **Migrations**: plain `.sql` files under `supabase/migrations/`, run via
  the Supabase SQL editor or `supabase db push` — no ORM migration
  framework, since the schema is small and stable.
- **CORS**: not a concern for the direct-Supabase model — PostgREST's CORS
  is controlled from the Supabase dashboard; no custom API server means no
  custom CORS config to get wrong.
- **Auth redirects**: the Vercel production domain (and any preview
  domains) must be added under Supabase → Authentication → URL
  Configuration → Redirect URLs.
- **Domain**: attach the custom domain in Vercel; no extra Supabase-side
  domain config needed for password-based auth.

## 17. Edge cases handled

- Renaming to a slug that collides with an existing sibling → "A topic
  with this slug already exists under the same parent" (translated from
  Postgres `23505`).
- Moving a topic into its own subtree (would create a cycle) → rejected
  inside `move_topic()` before any row is touched.
- Deleting a topic with descendants → confirmed with an exact count via
  `count_subtree()` first.
- Visiting a URL valid before a rename/move → resolved via
  `topic_redirects`, redirected client-side, never a dead 404.
- Visiting a URL that never existed → `NotFoundPage`, distinct from a
  network/database `ErrorState`.
- Empty parent select in the admin editor → treated as "top-level topic",
  not an error.
- Root-level slug collisions vs. same-slug-different-parent → both allowed
  and correctly enforced by the two partial unique indexes (§3).

## 18. Content movement walkthrough

Moving `system-design/rate-limiter/token-bucket` under `distributed-systems`:

1. Admin picks the new parent in `TopicEditor` and clicks **Apply slug /
   parent change**, calling `move_topic(topic_id, new_parent_id)`.
2. The function updates `topics.parent_id`. `trg_topics_set_path` recomputes
   `full_path` for that row (`distributed-systems/token-bucket`).
3. Because `full_path` changed, `trg_topics_cascade_path` fires: it writes
   a redirect from the old path to this topic's stable `id`, and rewrites
   `full_path` for every existing descendant (a `token-bucket` with its own
   children has each child's path prefix swapped too), writing a redirect
   for each.
4. The topic's `id` — and every admin-side reference to it — never
   changes. Markdown content that hard-codes internal links as relative
   paths would rely on the redirect table exactly like external links do;
   this is documented as a known limitation rather than silently claimed
   as auto-updating.

## 19. Versioning

**Not built for the MVP — explicitly out of scope**, per constraint #12.
Nothing in the brief calls for multi-author conflict resolution or
point-in-time rollback, and adding it now means a `topic_versions` table,
editor UI for diffing/restoring, and decisions about what "publish" means
relative to history — real scope with no stated requirement.

**How to add it later without a redesign**: add a `topic_versions` table
(`topic_id`, `content`, `title`, `created_by`, `created_at`) and write a
row to it inside the same trigger/transaction that updates
`topics.content` on every save. `topics.content` stays the
current/published version, so every query in this document keeps working
unmodified — the version table is purely additive.

## 20. Search

**Included** — PostgreSQL full-text search (§8) is sufficient at this
scale: no extra infrastructure (a GIN index in the same database),
built-in ranking and highlighted snippets (`ts_rank`, `ts_headline`), and
the same RLS-protected rows as every other public query (search can never
leak an unpublished page).

**When this stops being enough**: Postgres FTS doesn't do fuzzy/typo-
tolerant matching, synonym expansion, or engine-grade relevance tuning, and
ranking degrades on much larger corpora. If the docs set grows into the
tens of thousands of pages with real search-quality needs (typo tolerance,
faceting, sub-100ms search-as-you-type), that's the point to introduce a
dedicated engine (Meilisearch, Typesense, Algolia) — meaningfully past this
app's expected scale, so not built preemptively.

## 21. Error handling

| Case | Handling |
|---|---|
| 404 (no topic, no redirect) | `NotFoundPage` |
| 401 (not signed in, admin route) | `ProtectedRoute` → redirect to `/login`, return path preserved |
| 403 (RLS rejects a write) | Postgres `42501` → "You do not have permission to perform this action." |
| 500 / DB error | `ErrorState` with retry, shown by `DocPage`/`AdminDashboard` |
| Network error | same `ErrorState` path — supabase-js surfaces network failures as thrown errors like any other query error |
| Invalid Markdown | no such thing for a permissive parser — `react-markdown` renders whatever it's given; the sanitizer strips anything unsafe rather than rejecting the save |
| Duplicate slug | Postgres `23505` → "A topic with this slug already exists under the same parent." |
| Invalid parent | Postgres `23503` (FK violation) or the explicit cycle check in `move_topic()` → surfaced as a form error |

## 22. Future scalability considerations

- **Admin invites via Edge Function** (§12) — the one place service-role
  privilege is genuinely needed; not built in the MVP, called out
  explicitly rather than worked around insecurely.
- **Soft delete / trash can** — add `deleted_at timestamptz`, filter it out
  of every existing query (or wrap in a view), before enabling "restore".
- **Content versioning** — additive table, see §19.
- **Drag-and-drop reordering** — schema (`position`) already supports it;
  purely a frontend addition.
- **Dedicated search engine** — see §20 for the trigger condition.
- **SSR/SSG (Next.js) for real SEO** — see §15; the data layer is already
  framework-agnostic enough to make this a frontend-only migration.
- **Multi-language content** — would need a `locale` column and unique
  `(parent_id, slug, locale)`; not a concern until it's an actual
  requirement.
