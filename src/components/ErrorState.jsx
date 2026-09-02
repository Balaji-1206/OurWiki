export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm">
      <p className="font-medium text-red-800">{title}</p>
      {message && <p className="mt-1 text-red-700">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-red-800 hover:bg-red-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}
