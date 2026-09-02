import { Link } from 'react-router-dom';
import { useNavTree } from '../hooks/useNavTree';
import LoadingState from '../components/LoadingState';

export default function HomePage() {
  const { tree, loading } = useNavTree();

  return (
    <div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Documentation</h1>
      <p className="mb-8 text-muted">Browse the topics below, or use search to jump straight to a page.</p>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tree.map((topic) => (
            <Link
              key={topic.id}
              to={`/${topic.full_path}`}
              className="rounded-lg border border-border p-4 hover:border-accent-light"
            >
              <div className="font-medium">{topic.title}</div>
              {topic.children?.length > 0 && (
                <div className="mt-1 text-sm text-muted">{topic.children.length} subtopics</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
