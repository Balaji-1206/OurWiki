export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 py-16 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent-light" />
      {label}
    </div>
  );
}
