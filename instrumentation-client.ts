import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "development",
    tracesSampleRate:
      process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    sendDefaultPii: true,
    enableLogs: true,
    integrations: [
      Sentry.browserTracingIntegration({ enableInp: true }),
      Sentry.replayIntegration(),
    ],
    // Only propagate trace headers to same-origin requests.
    // Cross-origin (api-dev.jurisimus.com) is excluded to avoid CORS preflight
    // failures from sentry-trace/baggage headers the backend doesn't allow.
    tracePropagationTargets: ["localhost", /^\/(?!\/)/],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
