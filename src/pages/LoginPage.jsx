import { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { Shield, ArrowLeft, Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { signIn, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to={location.state?.from ?? '/admin'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setError('Incorrect email or password.');
      return;
    }
    navigate(location.state?.from ?? '/admin', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper p-4 text-ink transition-colors dark:bg-[#0d1117] dark:text-gray-100">
      <Link
        to="/"
        className="mb-8 flex items-center gap-1.5 text-xs text-muted transition hover:text-ink dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to documentation</span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent dark:bg-emerald-950/60 dark:text-emerald-400">
            <Shield className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Editor Sign In</h1>
          <p className="mt-1 text-xs text-muted dark:text-gray-400">
            Sign in with your Supabase account to edit pages and publish documentation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted dark:text-gray-400">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted dark:text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-lg border border-border bg-paper/50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted dark:text-gray-400">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted dark:text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-paper/50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-emerald-500"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-light disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {submitting ? 'Signing in...' : 'Sign in to Edit'}
          </button>
        </form>

        <div className="mt-6 rounded-lg border border-border/80 bg-paper/60 p-3 text-center text-[11px] text-muted dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
          <span>Accounts can be added directly in your Supabase project under <strong>Authentication &gt; Users</strong>.</span>
        </div>
      </div>
    </div>
  );
}
