export default function LoadingState({ label = 'Loading documentation...' }) {
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-muted dark:text-gray-400" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent dark:border-gray-700 dark:border-t-emerald-400" />
      <span>{label}</span>
    </div>
  );
}
