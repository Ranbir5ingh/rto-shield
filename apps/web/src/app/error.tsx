'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-5">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-risk">Error</p>
      <h1 className="mt-3 font-display font-medium text-display-2">Something went wrong.</h1>
      <p className="mt-3 text-sm leading-6 text-inksoft">The page did not finish loading. Nothing was sent to a buyer.</p>
      <button type="button" className="btn-go mt-6 w-fit" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
