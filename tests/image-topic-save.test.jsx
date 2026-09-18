import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { supabase } from '../src/lib/supabaseClient';
import { createImageMarkdown, insertImageMarkdown } from '../src/services/images';
import { updateTopic, getTopicByPath } from '../src/services/topics';
import MarkdownRenderer from '../src/components/MarkdownRenderer';

vi.mock('../src/lib/supabaseClient', () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

it('saves image Markdown through the existing topic service and renders it after reloading', async () => {
  const imageUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v123/ourwiki/stack.png';
  const original = 'A stack is LIFO.\n\nPush adds an element.';
  const markdown = createImageMarkdown(imageUrl, 'Stack diagram', 'Push and pop');
  const edited = insertImageMarkdown(original, 16, 16, markdown).content;
  let row = { id: 'topic-1', full_path: 'dsa/stack', content: original };

  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'test@example.invalid' } } });
  const query = {
    update: vi.fn((patch) => { row = { ...row, ...patch }; return query; }),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => ({ data: row, error: null })),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  const history = { insert: vi.fn(async () => ({ error: null })) };
  supabase.from.mockImplementation((table) => table === 'topics' ? query : history);

  const saved = await updateTopic('topic-1', { content: edited });
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ content: edited }));
  expect(saved.content).toContain(imageUrl);
  expect(history.insert).toHaveBeenCalledWith(expect.objectContaining({ content: edited }));

  const { topic } = await getTopicByPath('dsa/stack');
  const html = renderToStaticMarkup(<MarkdownRenderer content={topic.content} />);
  expect(html).toContain(`src="${imageUrl}"`);
  expect(html).toContain('alt="Stack diagram"');
  expect(html).toContain('Push and pop');
  expect(html).toContain('Push adds an element.');
});

it('does not report success when Supabase rejects the save', async () => {
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  const query = {
    update: vi.fn(() => query), select: vi.fn(() => query), eq: vi.fn(() => query),
    single: vi.fn(async () => ({ data: null, error: { code: '42501' } })),
  };
  supabase.from.mockReturnValue(query);
  await expect(updateTopic('topic-1', { content: '![Stack](https://example.com/stack.png)' }))
    .rejects.toThrow('permission');
});
