import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import handler from '../api/cloudinary-signature';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
const getUser = vi.fn();
function reply() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_UPLOAD_PRESET']) {
    vi.stubEnv(key, `test-${key}`);
  }
  vi.stubEnv('CLOUDINARY_ALLOWED_USER_IDS', '');
  createClient.mockReturnValue({ auth: { getUser } });
  getUser.mockResolvedValue({ data: { user: { id: 'trusted-user' } } });
});
afterEach(() => vi.unstubAllEnvs());

it('rejects GET and missing tokens', async () => {
  for (const [method, status] of [['GET', 405], ['POST', 401]]) {
    const res = reply();
    await handler({ method, headers: {} }, res);
    expect(res.status).toHaveBeenCalledWith(status);
  }
  expect(getUser).not.toHaveBeenCalled();
});
it('verifies tokens and rejects expired sessions', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') });
  const res = reply();
  await handler({ method: 'POST', headers: { authorization: 'Bearer expired' } }, res);
  expect(getUser).toHaveBeenCalledWith('expired');
  expect(res.status).toHaveBeenCalledWith(401);
});
it('enforces an optional contributor allowlist', async () => {
  vi.stubEnv('CLOUDINARY_ALLOWED_USER_IDS', 'someone-else');
  const res = reply();
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' } }, res);
  expect(res.status).toHaveBeenCalledWith(403);
});
it('signs only fixed parameters and never exposes the secret', async () => {
  const res = reply();
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' }, body: {
    public_id: 'victim', overwrite: true, upload_preset: 'attacker', userId: 'attacker',
  } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  const body = res.json.mock.calls[0][0];
  expect(body.params.public_id).toMatch(/^ourwiki\/trusted-user\/[\da-f-]+$/);
  expect(body.params.overwrite).toBe(false);
  expect(body.params.upload_preset).toBe('test-CLOUDINARY_UPLOAD_PRESET');
  expect(body.signature).toMatch(/^[\da-f]{40}$/);
  expect(JSON.stringify(body)).not.toContain('test-CLOUDINARY_API_SECRET');
});
it('fails safely on missing configuration or upstream failure', async () => {
  const res = reply();
  getUser.mockRejectedValue(new Error('private diagnostics'));
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' } }, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain('private diagnostics');
  vi.stubEnv('CLOUDINARY_API_SECRET', '');
  const unconfigured = reply();
  await handler({ method: 'POST', headers: { authorization: 'Bearer token' } }, unconfigured);
  expect(unconfigured.status).toHaveBeenCalledWith(503);
});
