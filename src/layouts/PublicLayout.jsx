import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import SearchBox from '../components/SearchBox';
import { useAuth } from '../contexts/AuthContext';

export default function PublicLayout() {
  const location = useLocation();
  const currentPath = location.pathname.replace(/^\/+/, '');
  const { isAdmin } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-border bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <button
            className="rounded-md border border-border p-1.5 md:hidden"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <Link to="/" className="font-semibold tracking-tight">
            Docs
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <SearchBox />
            <Link
              to={isAdmin ? '/admin' : '/login'}
              className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent-light"
            >
              {isAdmin ? 'Admin' : 'Sign in'}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
        <aside
          className={[
            'w-64 shrink-0 md:block',
            mobileNavOpen ? 'block' : 'hidden',
          ].join(' ')}
        >
          <Sidebar currentPath={currentPath} />
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
