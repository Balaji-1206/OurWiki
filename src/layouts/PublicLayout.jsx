import { Link, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Sun, Moon, BookOpen, Plus, LogIn, LogOut, User, FolderKanban } from 'lucide-react';
import SearchBox from '../components/SearchBox';
import { useAuth } from '../contexts/AuthContext';

export default function PublicLayout() {
  const { isAuthenticated, userEmail, signOut } = useAuth();

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
    <div className="min-h-screen bg-paper text-ink transition-colors duration-200 dark:bg-[#0d1117] dark:text-gray-100">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-[#0d1117]/95">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-ink dark:text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white shadow-sm dark:bg-emerald-600">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-lg font-extrabold tracking-tight">OurWiki</span>
          </Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <SearchBox />

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="rounded-lg border border-border p-1.5 text-muted transition hover:border-accent-light hover:text-ink dark:border-gray-700 dark:text-gray-400 dark:hover:border-accent-light dark:hover:text-white"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/admin/topics/new"
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-light dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Topic</span>
                </Link>

                <Link
                  to="/admin"
                  className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:border-accent-light hover:text-accent sm:flex dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                  title="Wiki Studio / Topics Management"
                >
                  <FolderKanban className="h-3.5 w-3.5 text-accent dark:text-emerald-400" />
                  <span>Studio</span>
                </Link>

                <div className="hidden items-center gap-1 rounded-full border border-border bg-paper/80 px-2.5 py-1 text-[11px] text-muted lg:flex dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <User className="h-3 w-3 text-accent dark:text-emerald-400" />
                  <span className="max-w-[130px] truncate" title={userEmail}>
                    {userEmail}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex items-center gap-1 rounded-lg border border-border p-1.5 text-xs text-muted transition hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-red-900 dark:hover:text-red-400"
                  title="Sign out of editor session"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:border-accent hover:text-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                title="Sign in to create and edit documentation (readers do not need to sign in)"
              >
                <LogIn className="h-3.5 w-3.5 text-accent dark:text-emerald-400" />
                <span>Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Expanded Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
