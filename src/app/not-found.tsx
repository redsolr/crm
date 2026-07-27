import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found-page min-h-screen bg-[var(--claude-dark)] flex items-center justify-center px-4">
      <div className="not-found-content text-center">
        <h1 className="not-found-title text-6xl font-bold text-[var(--claude-text)] mb-4">
          404
        </h1>
        <h2 className="not-found-subtitle text-2xl font-semibold text-[var(--theme-text-primary)] mb-4">
          Page Not Found
        </h2>
        <p className="not-found-description text-[var(--theme-text-secondary)] mb-8 max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="not-found-link inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
