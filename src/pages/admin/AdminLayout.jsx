import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLayout() {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/admin" className="font-semibold">
            Admin
          </Link>
          <Link to="/" className="text-sm text-muted hover:text-ink">
            View site
          </Link>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted">{profile?.display_name ?? profile?.role}</span>
            <button onClick={() => signOut()} className="rounded-md border border-border px-3 py-1.5 hover:border-accent-light">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
