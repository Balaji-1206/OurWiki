import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabaseClient';
import { createImageMarkdown, insertImageMarkdown, MAX_IMAGE_BYTES, uploadImage, validateImage, validateUploadResult } from './images';

vi.mock('../lib/supabaseClient', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
const ticket = {
  cloudName: 'test-cloud', apiKey: 'test-key', signature: 'test-signature',
  params: { public_id: 'ourwiki/user/asset', upload_preset: 'signed-preset', timestamp: 123, overwrite: false },
};
const result = {
  secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v123/ourwiki/user/asset.png',
  public_id: ticket.params.public_id, resource_type: 'image', format: 'png',
  version: 123, bytes: 100, width: 100, height: 100,
};
const response = (body, ok = true) => ({ ok, json: async () => body });
const file = () => new File(['image'], 'diagram.png', { type: 'image/png' });

beforeEach(() => {
  vi.clearAllMocks();
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('image validation and insertion', () => {
  it('rejects unsupported, empty and oversized files', () => {
    expect(() => validateImage({ type: 'image/svg+xml', size: 5 })).toThrow('PNG');
    expect(() => validateImage({ type: 'image/png', size: 0 })).toThrow('5 MB');
    expect(() => validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toThrow('5 MB');
    expect(() => validateImage(file())).not.toThrow();
    expect(() => validateImage(new File(['image'], 'diagram.jpg', { type: 'image/jpg' }))).not.toThrow();
    expect(() => validateImage(new File(['image'], 'diagram.jpeg', { type: '' }))).not.toThrow();
  });
  it('escapes descriptions and captions without introducing Markdown links', () => {
    const markdown = createImageMarkdown(result.secure_url, '[node] <script>', '*caption*');
    expect(markdown).toContain('\\[node\\] \\<script\\>');
    expect(markdown).toContain('*\\*caption\\**');
    expect(() => createImageMarkdown(result.secure_url, '  ')).toThrow('Describe');
    expect(() => createImageMarkdown('javascript:alert(1)', 'alt')).toThrow('HTTPS');
  });
  it('inserts at a selection and preserves surrounding text', () => {
    const inserted = insertImageMarkdown('beforeSELECTafter', 6, 12, 'IMAGE');
    expect(inserted.content).toBe('before\n\nIMAGE\n\nafter');
    expect(inserted.content.slice(inserted.cursor)).toBe('after');
  });
  it('rejects a foreign host, cloud, public ID or oversized response', () => {
    for (const patch of [
      { secure_url: result.secure_url.replace('res.cloudinary.com', 'res.cloudinary.com.evil.test') },
      { secure_url: result.secure_url.replace('test-cloud', 'other-cloud') },
      { public_id: 'another/asset' }, { bytes: MAX_IMAGE_BYTES + 1 },
    ]) expect(() => validateUploadResult({ ...result, ...patch }, ticket)).toThrow();
  });
});

describe('upload workflow', () => {
  it('sends the auth token only to our endpoint and uploads exact signed fields', async () => {
    fetch.mockResolvedValueOnce(response(ticket)).mockResolvedValueOnce(response(result));
    const uploaded = await uploadImage(file());
    expect(uploaded.displayUrl).toContain('f_auto,q_auto,c_limit,w_1400/v123/');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
    const [url, options] = fetch.mock.calls[1];
    expect(url).toBe('https://api.cloudinary.com/v1_1/test-cloud/image/upload');
    expect(options.headers).toBeUndefined();
    expect(options.body.get('overwrite')).toBe('false');
    expect(options.body.get('public_id')).toBe(ticket.params.public_id);
    expect(options.body.get('signature')).toBe(ticket.signature);
  });
  it('does not request a signature when logged out', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(uploadImage(file())).rejects.toThrow('Sign in');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not upload when the signature endpoint rejects the account', async () => {
    fetch.mockResolvedValue(response({ error: 'No upload access' }, false));
    await expect(uploadImage(file())).rejects.toThrow('No upload access');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('handles a Vite HTML response and Cloudinary failure', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('HTML'); } });
    await expect(uploadImage(file())).rejects.toThrow('vercel dev');
    fetch.mockResolvedValueOnce(response(ticket)).mockResolvedValueOnce(response({ error: { message: 'upstream' } }, false));
    await expect(uploadImage(file())).rejects.toThrow('could not be uploaded');
  });
  it('propagates cancellation without returning a Markdown insertion', async () => {
    const controller = new AbortController();
    fetch.mockResolvedValueOnce(response(ticket)).mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      controller.abort();
    }));
    await expect(uploadImage(file(), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
