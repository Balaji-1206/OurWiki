import { useEffect } from 'react';

/**
 * Deliberately not react-helmet-async: for a plain Vite SPA one more
 * dependency isn't worth it for "set title + a couple of meta tags".
 * See DESIGN.md's SEO section for why a client-only title/meta swap is a
 * *partial* SEO story, and what to reach for (SSR/prerendering) if organic
 * search ranking becomes a priority.
 */
export function Helmet({ title, description, canonical }) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) setMeta('description', description);
    if (canonical) setLink('canonical', canonical);

    // Open Graph
    if (title) setMeta('og:title', title, 'property');
    if (description) setMeta('og:description', description, 'property');
    if (canonical) setMeta('og:url', canonical, 'property');
    setMeta('og:type', 'article', 'property');
  }, [title, description, canonical]);

  return null;
}

function setMeta(name, content, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}
