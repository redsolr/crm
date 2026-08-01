import { NextResponse, type NextRequest } from "next/server";
import { currentActor, type RequestActor } from "@/server/actor";
import { realtimeEnabled, realtimeSocketUrl } from "@/server/realtime";

/**
 * `GET /api/realtime/session` — hands a session-authed browser its
 * WebSocket entry to the collaboration room: the wss:// URL with a
 * short-lived HMAC token baked in, plus the caller's own identity so
 * the client can exclude itself from presence rendering.
 *
 * 204 (no body) when realtime is not configured — the client treats
 * that as "feature off" and stays fully functional without it.
 *
 * MOCK_AUTH testing door: every mock session shares the `usr_local`
 * actor, which would make two test browsers one presence identity. A
 * `crm-mock-user` cookie (JSON `{id,name,email}`) differentiates them
 * — honored ONLY under MOCK_AUTH, never in production auth.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse | Response> {
  if (!realtimeEnabled()) {
    return new Response(null, { status: 204 });
  }
  const actor = mockOverride(request) ?? (await currentActor());
  return NextResponse.json({
    url: realtimeSocketUrl(actor),
    self: { id: actor.id, name: actor.name, email: actor.email },
  });
}

function mockOverride(request: NextRequest): RequestActor | null {
  if (process.env.MOCK_AUTH !== "true") return null;
  const raw = request.cookies.get("crm-mock-user")?.value;
  if (raw === undefined) return null;
  try {
    // Cookie values arrive URI-encoded (JSON braces/quotes aren't
    // cookie-safe raw).
    const parsed = JSON.parse(decodeURIComponent(raw)) as {
      id?: string;
      name?: string;
      email?: string;
    };
    if (typeof parsed.id !== "string" || parsed.id === "") return null;
    return {
      id: parsed.id,
      name: parsed.name ?? null,
      email: parsed.email ?? null,
    };
  } catch (err) {
    console.warn("[realtime/session] bad crm-mock-user cookie:", err);
    return null;
  }
}
