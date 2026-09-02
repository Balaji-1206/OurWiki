// Vercel Serverless Function: GET /api/sitemap.xml
// Runs server-side, so it can safely use its own read-only Supabase client.
// Uses the anon key + RLS (only published rows are readable) — no
// service_role key needed here either.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  const { data, error } = await supabase
    .from('topics')
    .select('full_path, updated_at')
    .eq('status', 'published');

  if (error) {
    res.status(500).send('Could not generate sitemap');
    return;
  }

  const origin = `https://${req.headers.host}`;
  const urls = data
    .map(
      (t) => `  <url>
    <loc>${origin}/${t.full_path}</loc>
    <lastmod>${new Date(t.updated_at).toISOString()}</lastmod>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // CDN caches for an hour
  res.status(200).send(xml);
}
