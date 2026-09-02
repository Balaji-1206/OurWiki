import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingState from '../../components/LoadingState';

/**
 * This check is a UX convenience only — it stops a logged-out visitor from
 * seeing the admin shell flash on screen. It grants nothing: every query and
 * mutation the admin UI makes is re-checked by Postgres RLS (is_admin()),
 * so bypassing this component client-side would just produce 403s, not data.
 */
export default function ProtectedRoute({ children }) {
  const { loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Checking session…" />;
  if (!isAdmin) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}
