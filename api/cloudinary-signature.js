import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

// All authenticated accounts are contributors in the current OurWiki schema.
// Set CLOUDINARY_ALLOWED_USER_IDS to restrict uploads to a subset of accounts.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST to request an upload.' });
  }

  const authorization = req.headers.authorization;
  const token = typeof authorization === 'string'
    ? authorization.match(/^Bearer\s+(\S+)$/i)?.[1]
    : null;
  if (!token) return res.status(401).json({ error: 'Sign in before uploading an image.' });

  const {
    SUPABASE_URL, SUPABASE_ANON_KEY, CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_UPLOAD_PRESET,
    CLOUDINARY_ALLOWED_USER_IDS,
  } = process.env;
  if (![SUPABASE_URL, SUPABASE_ANON_KEY, CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_UPLOAD_PRESET].every(Boolean)) {
    return res.status(503).json({ error: 'Image uploads are not configured. Contact the site owner.' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Your session expired. Sign in again before uploading.' });
    }
    const allowed = (CLOUDINARY_ALLOWED_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(data.user.id)) {
      return res.status(403).json({ error: 'This account does not have image upload access.' });
    }

    // Ignore client-supplied parameters. The signed preset must enforce a 5 MB
    // limit. Unique IDs + overwrite=false also prevent replacement by replay.
    const params = {
      timestamp: Math.floor(Date.now() / 1000),
      upload_preset: CLOUDINARY_UPLOAD_PRESET,
      public_id: `ourwiki/${data.user.id}/${randomUUID()}`,
      overwrite: false,
      allowed_formats: 'jpg,png,webp',
      type: 'upload',
    };
    const signature = cloudinary.utils.api_sign_request(params, CLOUDINARY_API_SECRET);
    return res.status(200).json({
      cloudName: CLOUDINARY_CLOUD_NAME, apiKey: CLOUDINARY_API_KEY, signature, params,
    });
  } catch {
    // Do not send credentials, tokens or upstream diagnostics to the browser.
    return res.status(503).json({ error: 'Image uploads are temporarily unavailable. Please try again.' });
  }
}
