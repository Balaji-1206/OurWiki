import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import MarkdownRenderer from '../src/components/MarkdownRenderer';
import { createImageMarkdown } from '../src/services/images';

it('renders escaped alt text, captions, and surrounding content', () => {
  const markdown = createImageMarkdown('https://res.cloudinary.com/demo/image/upload/test.png', '[A] <B>', 'A *caption*');
  const html = renderToStaticMarkup(<MarkdownRenderer content={`Before\n\n${markdown}\n\nAfter`} />);
  expect(html).toContain('alt="[A] &lt;B&gt;"');
  expect(html).toContain('loading="lazy"');
  expect(html).toContain('decoding="async"');
  expect(html).toContain('<em>A *caption*</em>');
  expect(html).toContain('Before');
  expect(html).toContain('After');
});
it('preserves external images and rejects unsafe Markdown image URLs', () => {
  const html = renderToStaticMarkup(<MarkdownRenderer content={'![External](https://example.com/image.png)\n\n![Bad](javascript:alert)'} />);
  expect(html).toContain('src="https://example.com/image.png"');
  expect(html).not.toContain('src="javascript:');
  expect(html).toContain('Image unavailable');
});
