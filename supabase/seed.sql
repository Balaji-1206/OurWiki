-- Sample content matching the brief's example tree. Run after 0001_init.sql.
-- Replace the created_by value with a real profiles.id once you have one, or
-- leave null (created_by is nullable).

insert into public.topics (id, parent_id, slug, title, content, status)
values
  ('00000000-0000-0000-0000-000000000001', null, 'system-design', 'System Design',
   E'# System Design\n\nNotes on designing large-scale systems.', 'published');

insert into public.topics (parent_id, slug, title, content, status)
values
  ('00000000-0000-0000-0000-000000000001', 'rate-limiter', 'Rate Limiter',
   E'# Rate Limiter\n\nA rate limiter controls how many requests a client can make in a given time window.\n\n## Why it matters\n\n- Protects backends from overload\n- Enforces fair usage\n- Mitigates abuse and scraping\n', 'published'),
  ('00000000-0000-0000-0000-000000000001', 'load-balancer', 'Load Balancer',
   E'# Load Balancer\n\nDistributes traffic across a fleet of servers.', 'published'),
  ('00000000-0000-0000-0000-000000000001', 'caching', 'Caching',
   E'# Caching\n\nTrading storage for latency.', 'draft');

insert into public.topics (parent_id, slug, title, content, status)
select id, 'token-bucket', 'Token Bucket',
  E'# Token Bucket\n\nThe token bucket algorithm maintains a bucket of tokens that refills at a fixed rate.\n\n```js\nconst bucket = {\n  capacity: 10,\n  tokens: 10,\n};\n\nfunction tryConsume(bucket, n = 1) {\n  if (bucket.tokens >= n) {\n    bucket.tokens -= n;\n    return true;\n  }\n  return false;\n}\n```\n\n> A request is only allowed through if a token is available.\n',
  'published'
from public.topics where full_path = 'system-design/rate-limiter';

insert into public.topics (parent_id, slug, title, content, status)
select id, 'sliding-window', 'Sliding Window',
  E'# Sliding Window\n\nCounts requests in a moving time window rather than fixed buckets.', 'published'
from public.topics where full_path = 'system-design/rate-limiter';

insert into public.topics (parent_id, slug, title, content, status)
values
  (null, 'database', 'Database', E'# Database\n\nNotes on databases.', 'published');

insert into public.topics (parent_id, slug, title, content, status)
select id, 'indexing', 'Indexing', E'# Indexing\n\nHow indexes speed up reads at the cost of writes.', 'published'
from public.topics where full_path = 'database';

insert into public.topics (parent_id, slug, title, content, status)
select id, 'b-tree', 'B-Tree', E'# B-Tree\n\nThe default index structure in PostgreSQL.', 'published'
from public.topics where full_path = 'database/indexing';
