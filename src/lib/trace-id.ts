/**
 * Shared trace ID generator.
 * Produces W3C-compatible 32-hex-char trace IDs and 16-hex-char span IDs
 * used by both Sentry and Grafana Faro so all telemetry correlates
 * in Grafana Tempo under a single trace.
 */

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateTraceId(): string {
  return randomHex(16); // 32 hex chars
}

export function generateSpanId(): string {
  return randomHex(8); // 16 hex chars
}

/**
 * Build a W3C traceparent header value.
 * Format: 00-{traceId}-{spanId}-{flags}
 */
export function buildTraceparent(
  traceId: string,
  spanId: string,
  sampled = true,
): string {
  return `00-${traceId}-${spanId}-${sampled ? "01" : "00"}`;
}
