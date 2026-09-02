import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from './helmet-lite';
import { getTopicByPath } from '../services/topics';
import Breadcrumbs from '../components/Breadcrumbs';
import PrevNextNav from '../components/PrevNextNav';
import MarkdownRenderer from '../components/MarkdownRenderer';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import NotFoundPage from './NotFoundPage';

export default function DocPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.replace(/^\/+/, '');

  const [state, setState] = useState({ status: 'loading', topic: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', topic: null, error: null });

    getTopicByPath(path)
      .then(({ topic, redirectedFrom }) => {
        if (cancelled) return;
        if (redirectedFrom) {
          // 301-style: replace history entry so the old URL never sticks around.
          navigate(`/${topic.full_path}`, { replace: true });
          return;
        }
        if (!topic) {
          setState({ status: 'not-found', topic: null, error: null });
          return;
        }
        setState({ status: 'ready', topic, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', topic: null, error });
      });

    return () => {
      cancelled = true;
    };
  }, [path, navigate]);

  if (state.status === 'loading') return <LoadingState label="Loading page…" />;
  if (state.status === 'not-found') return <NotFoundPage />;
  if (state.status === 'error') {
    return (
      <ErrorState
        title="Couldn't load this page"
        message={state.error?.message ?? 'A database error occurred.'}
        onRetry={() => navigate(0)}
      />
    );
  }

  const { topic } = state;
  const canonicalUrl = `${window.location.origin}/${topic.full_path}`;

  return (
    <article>
      <Helmet
        title={`${topic.title} · Docs`}
        description={topic.meta_description ?? topic.content.slice(0, 155)}
        canonical={canonicalUrl}
      />
      <Breadcrumbs path={topic.full_path} />
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">{topic.title}</h1>
      <MarkdownRenderer content={topic.content} />
      <PrevNextNav currentPath={topic.full_path} />
    </article>
  );
}
