import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { searchTopics } from '../services/topics';

export default function SearchBox() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchTopics(q)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250); // debounce
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search docs…"
        className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-accent-light"
        aria-label="Search documentation"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-md border border-border bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <Link
                to={`/${r.full_path}`}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm hover:bg-black/5"
              >
                <div className="font-medium">{r.title}</div>
                <div
                  // ts_headline() wraps matched terms in <b> tags server-side. Safe to
                  // inject as-is because topic content is authored only by admins
                  // (enforced by RLS) — never by public/anonymous input.
                  className="mt-0.5 text-xs text-muted [&_mark]:bg-yellow-200 [&_mark]:text-ink"
                  dangerouslySetInnerHTML={{ __html: r.snippet }}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
