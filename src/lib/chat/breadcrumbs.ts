import * as Sentry from "@sentry/nextjs";

/**
 * Drop a Sentry breadcrumb tagged with "chat-stream" so that, when a user
 * reports "I clicked send and nothing happened", the Sentry trail on the
 * crash report shows exactly where the chain stopped — instead of forcing
 * an engineer to bisect through 8 separate silent-failure points.
 *
 * Wraps `Sentry.addBreadcrumb` in a try/catch because Sentry's SSR/edge
 * builds occasionally throw on `addBreadcrumb` if the SDK isn't yet
 * initialised — we never want telemetry to break the chat flow.
 *
 * See also: CLAUDE.md — "never swallow errors". The catch here logs a
 * `console.warn` rather than failing silently.
 */
export function chatBreadcrumb(
  message: string,
  level: "info" | "warning" | "error" = "info",
  data?: Record<string, unknown>,
): void {
  try {
    Sentry.addBreadcrumb({
      category: "chat-stream",
      message,
      level,
      data,
    });
  } catch (err) {
    console.warn("[chatApi] Failed to record Sentry breadcrumb:", err);
  }
}
