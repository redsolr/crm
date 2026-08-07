/** @jest-environment node */

/**
 * Push subscription routes contract: the layer is env-gated (no VAPID
 * keys ⇒ vapid-key answers null and subscribe answers 503), bodies are
 * validated, and a valid subscribe upserts with the session actor.
 */

import { NextRequest } from "next/server";
import { GET as getVapidKey } from "@/app/api/notifications/vapid-key/route";
import {
  DELETE as deleteSubscription,
  POST as postSubscription,
} from "@/app/api/notifications/push/subscribe/route";
import {
  removePushSubscription,
  upsertPushSubscription,
} from "@/server/push";

jest.mock("@/server/push", () => {
  const actual = jest.requireActual<typeof import("@/server/push")>(
    "@/server/push",
  );
  return {
    ...actual,
    upsertPushSubscription: jest.fn(),
    removePushSubscription: jest.fn(),
  };
});

jest.mock("@/server/actor", () => ({
  currentActor: jest.fn().mockResolvedValue({
    id: "usr_test",
    name: "Test User",
    email: "test@jurisimus.com",
  }),
}));

const mockedUpsert = upsertPushSubscription as jest.MockedFunction<
  typeof upsertPushSubscription
>;
const mockedRemove = removePushSubscription as jest.MockedFunction<
  typeof removePushSubscription
>;

const VALID_SUBSCRIPTION = {
  endpoint: "https://push.example.com/sub/abc",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};

function jsonRequest(method: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost:3100/api/notifications/push/subscribe", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function withVapidEnv(configured: boolean): void {
  if (configured) {
    process.env.VAPID_PUBLIC_KEY = "test-public-key";
    process.env.VAPID_PRIVATE_KEY = "test-private-key";
  } else {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  }
}

describe("push routes", () => {
  const previousPublic = process.env.VAPID_PUBLIC_KEY;
  const previousPrivate = process.env.VAPID_PRIVATE_KEY;
  beforeEach(() => {
    mockedUpsert.mockReset();
    mockedRemove.mockReset();
  });
  afterEach(() => {
    if (previousPublic === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = previousPublic;
    if (previousPrivate === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = previousPrivate;
  });

  it("vapid-key answers null when the push layer is unconfigured", async () => {
    withVapidEnv(false);
    const res = getVapidKey();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ publicKey: null });
  });

  it("vapid-key serves the configured public key", async () => {
    withVapidEnv(true);
    const res = getVapidKey();
    expect(await res.json()).toEqual({ publicKey: "test-public-key" });
  });

  it("subscribe answers 503 when the push layer is unconfigured", async () => {
    withVapidEnv(false);
    const res = await postSubscription(
      jsonRequest("POST", VALID_SUBSCRIPTION),
    );
    expect(res.status).toBe(503);
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("subscribe validates the body", async () => {
    withVapidEnv(true);
    const res = await postSubscription(
      jsonRequest("POST", { endpoint: "not-a-url", keys: {} }),
    );
    expect(res.status).toBe(422);
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("subscribe upserts with the session actor stamped", async () => {
    withVapidEnv(true);
    const res = await postSubscription(
      jsonRequest("POST", VALID_SUBSCRIPTION),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ subscribed: true });
    expect(mockedUpsert).toHaveBeenCalledWith(
      VALID_SUBSCRIPTION,
      { id: "usr_test", name: "Test User" },
      null,
    );
  });

  it("unsubscribe removes by endpoint", async () => {
    const res = await deleteSubscription(
      jsonRequest("DELETE", { endpoint: VALID_SUBSCRIPTION.endpoint }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ subscribed: false });
    expect(mockedRemove).toHaveBeenCalledWith(VALID_SUBSCRIPTION.endpoint);
  });
});
