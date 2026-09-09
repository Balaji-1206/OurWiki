import { useState, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Shield, ExternalLink, LogOut, Sun, Moon, ArrowLeft, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLayout() {
  const { signOut, displayName, userEmail } = useAuth();

  // Theme management with localStorage persistence and system preference
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-paper text-ink transition-colors dark:bg-[#0d1117] dark:text-gray-100">
      <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/admin" className="flex items-center gap-2.5 font-bold tracking-tight text-ink dark:text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white shadow-sm dark:bg-emerald-600">
              <Shield className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold leading-none tracking-tight">Wiki Studio</span>
              <span className="text-[10px] font-medium text-muted dark:text-gray-400">Content Management</span>
            </div>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-paper/60 px-2.5 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Public Wiki</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </Link>

          <div className="ml-auto flex items-center gap-2.5 text-xs">
            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="rounded-lg border border-border p-1.5 text-muted transition hover:border-accent hover:text-ink dark:border-gray-700 dark:text-gray-400 dark:hover:text-white"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-[11px] shadow-xs dark:border-gray-700 dark:bg-gray-800">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/15 text-[9px] font-bold text-accent dark:bg-emerald-950 dark:text-emerald-400">
                <User className="h-2.5 w-2.5" />
              </div>
              <span className="max-w-[130px] truncate font-medium text-ink dark:text-gray-200" title={userEmail}>
                {displayName || userEmail?.split('@')[0] || 'Editor'}
              </span>
              <span className="rounded bg-accent/10 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-accent dark:bg-emerald-950/80 dark:text-emerald-300">
                Editor
              </span>
            </div>

            {/* Sign Out */}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1 rounded-lg border border-border p-1.5 text-xs text-muted transition hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-red-900 dark:hover:text-red-400"
              title="Sign out of editor session"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
