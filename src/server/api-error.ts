import { NextResponse } from "next/server";

/**
 * Error envelope mirroring the platform's `HttpExceptionFilter` shape —
 * `buildApiError` in `src/lib/api-client.ts` reads `code` / `message`
 * off this body, so local route handlers must speak it verbatim.
 */

const REASON_PHRASES: Record<number, string> = {
  400: "Bad Request",
  404: "Not Found",
  409: "Conflict",
  412: "Precondition Failed",
  422: "Unprocessable Entity",
  428: "Precondition Required",
  500: "Internal Server Error",
};

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      statusCode: status,
      error: REASON_PHRASES[status] ?? "Error",
      code,
      message,
      ...(details === undefined ? {} : { details }),
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

/**
 * Parse the `If-Match: W/"v<n>"` optimistic-concurrency header
 * (api-discipline § C4). Returns the version number, or null when the
 * header is absent/malformed (caller responds 428).
 */
export function parseIfMatchVersion(request: Request): number | null {
  const raw = request.headers.get("if-match");
  if (raw === null) return null;
  const match = /^W\/"v(\d+)"$/.exec(raw.trim());
  if (!match) return null;
  return Number(match[1]);
}
