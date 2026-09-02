import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PublicLayout from './layouts/PublicLayout';
import HomePage from './pages/HomePage';
import DocPage from './pages/DocPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import TopicEditor from './pages/admin/TopicEditor';
import ProtectedRoute from './pages/admin/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="topics/new" element={<TopicEditor />} />
            <Route path="topics/:id" element={<TopicEditor />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />

          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            {/* Catch-all: any other path is a candidate documentation page.
                DocPage itself resolves it (or redirects, or 404s). Keeping a
                single flexible route here — rather than one route per nesting
                depth — is what lets the hierarchy go arbitrarily deep. */}
            <Route path="*" element={<DocPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
