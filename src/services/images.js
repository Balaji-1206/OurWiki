import { supabase } from '../lib/supabaseClient';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImage(file) {
  if (!file) throw new Error('Choose an image first.');
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('Choose an image smaller than or equal to 5 MB.');
}

async function readJson(response, fallback) {
  let body;
  try { body = await response.json(); } catch { throw new Error(fallback); }
  if (!response.ok) {
    // Cloudinary errors are not exposed verbatim; our endpoint supplies safe messages.
    throw new Error(typeof body.error === 'string' ? body.error : fallback);
  }
  return body;
}

export function validateUploadResult(result, ticket) {
  let url;
  try { url = new URL(result.secure_url); } catch { throw new Error('The upload returned an invalid image URL.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
    url.port || url.username || url.password || url.search || url.hash ||
    !url.pathname.startsWith(`/${ticket.cloudName}/image/upload/`) ||
    result.public_id !== ticket.params.public_id || result.resource_type !== 'image' ||
    !['jpg', 'png', 'webp'].includes(result.format) ||
    !Number.isInteger(result.version) || result.version <= 0 ||
    !Number.isInteger(result.bytes) || result.bytes <= 0 || result.bytes > MAX_IMAGE_BYTES ||
    !Number.isInteger(result.width) || result.width <= 0 ||
    !Number.isInteger(result.height) || result.height <= 0) {
    throw new Error('The upload response could not be verified. Please try again.');
  }
  const assetPath = result.public_id.split('/').map(encodeURIComponent).join('/');
  const suffix = `v${result.version}/${assetPath}.${result.format}`;
  if (url.pathname !== `/${ticket.cloudName}/image/upload/${suffix}`) {
    throw new Error('The uploaded image URL does not match the requested image.');
  }
  return {
    secureUrl: result.secure_url,
    displayUrl: `https://res.cloudinary.com/${ticket.cloudName}/image/upload/f_auto,q_auto,c_limit,w_1400/${suffix}`,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}

export async function uploadImage(file, { signal } = {}) {
  validateImage(file);
  const { data, error } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !token) throw new Error('Sign in before uploading an image.');
  const ticket = await readJson(await fetch('/api/cloudinary-signature', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal,
  }), 'Could not start the upload. Run the app with vercel dev and check its configuration.');
  if (!/^[a-zA-Z0-9_-]+$/.test(ticket.cloudName || '') || !ticket.apiKey ||
    !ticket.signature || !ticket.params?.public_id || !ticket.params?.upload_preset) {
    throw new Error('The upload configuration is invalid. Contact the site owner.');
  }
  const body = new FormData();
  body.append('file', file);
  body.append('api_key', ticket.apiKey);
  body.append('signature', ticket.signature);
  for (const [key, value] of Object.entries(ticket.params)) body.append(key, String(value));
  const result = await readJson(await fetch(`https://api.cloudinary.com/v1_1/${ticket.cloudName}/image/upload`, {
    method: 'POST', body, signal,
  }), 'The image could not be uploaded. Check the file and try again.');
  return validateUploadResult(result, ticket);
}

export function escapeMarkdownText(value) {
  return String(value).replace(/[\r\n]+/g, ' ').trim().replace(/[\\`*_{}\[\]()<>!#|&]/g, '\\$&');
}

export function createImageMarkdown(url, alt, caption = '') {
  if (!alt.trim()) throw new Error('Describe the image for readers who cannot see it.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || /[\s<>\\]/.test(url)) throw new Error('Use a valid HTTPS image URL.');
  return `![${escapeMarkdownText(alt)}](<${url}>)` +
    (caption.trim() ? `\n\n*${escapeMarkdownText(caption)}*` : '');
}

export function insertImageMarkdown(content, start, end, markdown) {
  // The editor stays read-only while the dialog is open, preserving these offsets.
  const from = Math.max(0, Math.min(start, content.length));
  const to = Math.max(from, Math.min(end, content.length));
  const block = `\n\n${markdown}\n\n`;
  return { content: content.slice(0, from) + block + content.slice(to), cursor: from + block.length };
}
