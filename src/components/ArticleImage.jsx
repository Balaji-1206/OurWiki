import { useState } from 'react';

export default function ArticleImage({ src, alt = '', title }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span role="img" aria-label={alt || 'Image unavailable'} className="block rounded-lg border border-border p-4 text-sm text-muted dark:border-gray-700 dark:text-gray-400">
      Image unavailable{alt ? `: ${alt}` : ''}
    </span>;
  }
  return <img src={src} alt={alt} title={title} loading="lazy" decoding="async"
    onError={() => setFailed(true)}
    className="mx-auto h-auto max-w-full rounded-xl border border-border bg-white shadow-sm dark:border-gray-700" />;
}
