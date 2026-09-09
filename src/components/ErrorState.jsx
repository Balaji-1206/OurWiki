import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/80 p-6 text-sm dark:border-red-900/50 dark:bg-red-950/30">
      <div className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-300">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{title}</span>
      </div>
      {message && <p className="mt-2 text-xs text-red-700 leading-relaxed dark:text-red-400">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 shadow-sm transition hover:bg-red-50 dark:border-red-800 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-gray-850"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
}
