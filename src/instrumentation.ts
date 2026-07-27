import * as Sentry from "@sentry/nextjs";

/**
 * Inlined Sentry init — previously this file used `await import("../sentry.server.config")`
 * which Next 16 + Turbopack caches as a resolved module reference under
 * `.next/dev/server/instrumentation.js`. When the cache goes stale across
 * branch switches / Next-version bumps the dev server fails to boot with
 * `Could not parse module '[project]/src/instrumentation.ts', file not found`,
 * forcing a `rm -rf .next/` reset.
 *
 * Inlining `Sentry.init(...)` here removes the dynamic-import edge so the
 * register() body is self-contained — there's nothing to stale-resolve.
 * The sibling sentry.{server,edge}.config.ts files are kept only because
 * `@sentry/nextjs`'s build-time webpack plugin still introspects them
 * (`withSentryConfig` in next.config.ts); editing them no longer affects
 * runtime behavior.
 */
export async function register() {
  const sharedInit = {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    enableLogs: true,
    sendDefaultPii: true,
  } as const;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(sharedInit);
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sharedInit);
  }
}

export const onRequestError = Sentry.captureRequestError;
