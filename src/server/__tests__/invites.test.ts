import {
  acceptInviteSchema,
  actorMayManageInvites,
  createInviteSchema,
  inviteStatus,
  mintInviteCode,
  serializeInvite,
  serializePublicInvite,
  type InviteRow,
} from "@/server/invites";
import { LOCAL_ACTOR_ID } from "@/server/constants";

function row(overrides: Partial<InviteRow> = {}): InviteRow {
  return {
    id: "inv_abc",
    code: "codecodecodecodecodecode",
    email: "teammate@example.com",
    invitedById: "user_01ABC",
    invitedByName: "Kreethup",
    expiresAt: new Date("2026-08-10T00:00:00Z"),
    acceptedAt: null,
    revokedAt: null,
    workosUserId: null,
    createdAt: new Date("2026-08-03T00:00:00Z"),
    updatedAt: new Date("2026-08-03T00:00:00Z"),
    ...overrides,
  };
}

const NOW = new Date("2026-08-04T00:00:00Z");

describe("inviteStatus", () => {
  it("is pending while unaccepted, unrevoked, and unexpired", () => {
    expect(inviteStatus(row(), NOW)).toBe("pending");
  });

  it("expires strictly at the deadline", () => {
    expect(
      inviteStatus(row({ expiresAt: new Date("2026-08-04T00:00:00Z") }), NOW),
    ).toBe("expired");
  });

  it("accepted wins over expiry (a used seat never reads expired)", () => {
    expect(
      inviteStatus(
        row({
          acceptedAt: new Date("2026-08-03T12:00:00Z"),
          expiresAt: new Date("2026-08-01T00:00:00Z"),
        }),
        NOW,
      ),
    ).toBe("accepted");
  });

  it("revoked wins over everything", () => {
    expect(
      inviteStatus(
        row({
          revokedAt: new Date("2026-08-03T13:00:00Z"),
          acceptedAt: new Date("2026-08-03T12:00:00Z"),
        }),
        NOW,
      ),
    ).toBe("revoked");
  });
});

describe("invite serialization", () => {
  it("admin shape carries the code as a path, never bare", () => {
    const wire = serializeInvite(row());
    expect(wire.invite_path).toBe("/invite/codecodecodecodecodecode");
    expect(wire).not.toHaveProperty("code");
    expect(wire.email).toBe("teammate@example.com");
  });

  it("public shape never leaks the code or ids", () => {
    const wire = serializePublicInvite(row());
    expect(wire).toEqual({
      email: "teammate@example.com",
      status: expect.any(String) as unknown,
      invited_by_name: "Kreethup",
      expires_at: "2026-08-10T00:00:00.000Z",
    });
  });
});

describe("mintInviteCode", () => {
  it("mints high-entropy URL-safe unique codes", () => {
    const a = mintInviteCode();
    const b = mintInviteCode();
    expect(a).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect(a).not.toBe(b);
  });
});

describe("createInviteSchema", () => {
  it("normalizes the email (trim + lowercase)", () => {
    const parsed = createInviteSchema.parse({
      email: "  Somebody@Example.COM ",
    });
    expect(parsed.email).toBe("somebody@example.com");
  });

  it("rejects non-emails", () => {
    expect(createInviteSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("acceptInviteSchema", () => {
  it("accepts the oauth method with no extra fields", () => {
    expect(acceptInviteSchema.parse({ method: "oauth" })).toEqual({
      method: "oauth",
    });
  });

  it("requires a 10+ char password on the password method", () => {
    expect(
      acceptInviteSchema.safeParse({ method: "password", password: "short" })
        .success,
    ).toBe(false);
    expect(
      acceptInviteSchema.safeParse({
        method: "password",
        password: "long-enough-secret",
        first_name: "A",
      }).success,
    ).toBe(true);
  });
});

describe("actorMayManageInvites", () => {
  const previous = process.env.MOCK_AUTH;
  afterEach(() => {
    if (previous === undefined) delete process.env.MOCK_AUTH;
    else process.env.MOCK_AUTH = previous;
  });

  it("allows any real session actor", () => {
    delete process.env.MOCK_AUTH;
    expect(actorMayManageInvites("user_01REAL")).toBe(true);
  });

  it("blocks the session-less fallback actor outside MOCK_AUTH", () => {
    delete process.env.MOCK_AUTH;
    expect(actorMayManageInvites(LOCAL_ACTOR_ID)).toBe(false);
  });

  it("allows the fallback actor under MOCK_AUTH (dev/e2e)", () => {
    process.env.MOCK_AUTH = "true";
    expect(actorMayManageInvites(LOCAL_ACTOR_ID)).toBe(true);
  });
});
