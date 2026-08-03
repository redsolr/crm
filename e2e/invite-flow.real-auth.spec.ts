import { test, expect } from "@playwright/test";
import { WorkOS } from "@workos-inc/node";
import { envLocal, loginWithPassword } from "./helpers/real-auth";

/**
 * Owned invite flow against the REAL stack (Tier 2 — real WorkOS +
 * real Postgres, no mocks).
 *
 * Claim: an admin-created invite admits a brand-new person end-to-end
 * on OUR surfaces — create → branded /invite/<code> page → password
 * accept → provisioned AuthKit user → live session in the app — and a
 * revoked invite stops admitting.
 *
 * The spec provisions a REAL WorkOS user (synthetic email, no mailbox
 * — the password path never needs one) and deletes it in cleanup via
 * the WorkOS API, so Staging doesn't accumulate seats.
 */

const adminEmail = envLocal("E2E_WORKOS_EMAIL");
const adminPassword = envLocal("E2E_WORKOS_PASSWORD");
const workosApiKey = envLocal("WORKOS_API_KEY");

const stamp = Date.now().toString(36);
const INVITEE_EMAIL = `crm-e2e-invitee-${stamp}@jurisimus.com`;
const INVITEE_PASSWORD = `E2e-invite-${stamp}-secret!`;

test("invite → branded accept → provisioned seat → live session; revoke closes the door", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  test.skip(
    !adminEmail || !adminPassword || !workosApiKey,
    "E2E_WORKOS_* / WORKOS_API_KEY missing (env or .env.local)",
  );

  const adminContext = await browser.newContext();
  const inviteeContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const inviteePage = await inviteeContext.newPage();
  let inviteeWorkosUserId: string | null = null;

  try {
    // ── Admin creates the invite (and a second one to revoke) ──────
    await loginWithPassword(adminPage, adminEmail!, adminPassword!);
    const createRes = await adminPage.request.post("/api/invites", {
      data: { email: INVITEE_EMAIL },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as {
      invite: { id: string; invite_path: string; status: string };
    };
    expect(created.invite.status).toBe("pending");

    // ── Invitee (no session) accepts with a password ────────────────
    await inviteePage.goto(created.invite.invite_path);
    await expect(inviteePage.getByTestId("invite-email")).toHaveText(
      INVITEE_EMAIL,
      { timeout: 30_000 },
    );
    await inviteePage.getByTestId("invite-first-name").fill("Invited");
    await inviteePage.getByTestId("invite-last-name").fill("Byspec");
    await inviteePage
      .getByTestId("invite-password-input")
      .fill(INVITEE_PASSWORD);
    await inviteePage.getByTestId("invite-submit").click();

    // The accept signed them in — the app shell renders THEIR seat.
    await inviteePage.waitForURL("**/sales", { timeout: 45_000 });
    await expect(inviteePage.getByTestId("crm-sidebar-user")).toContainText(
      INVITEE_EMAIL,
      { timeout: 45_000 },
    );

    // The invite reads accepted on the admin surface.
    const listRes = await adminPage.request.get("/api/invites");
    const list = (await listRes.json()) as {
      data: Array<{ id: string; status: string }>;
    };
    expect(
      list.data.find((i) => i.id === created.invite.id)?.status,
    ).toBe("accepted");

    // ── Revoke closes the door ──────────────────────────────────────
    const secondRes = await adminPage.request.post("/api/invites", {
      data: { email: `revoked-${INVITEE_EMAIL}` },
    });
    const second = (await secondRes.json()) as {
      invite: { id: string; invite_path: string };
    };
    const revokeRes = await adminPage.request.delete(
      `/api/invites/${second.invite.id}`,
    );
    expect(revokeRes.status()).toBe(200);
    const deadPage = await inviteeContext.newPage();
    await deadPage.goto(second.invite.invite_path);
    await expect(deadPage.getByTestId("invite-invalid")).toBeVisible({
      timeout: 30_000,
    });
    await deadPage.close();
  } finally {
    // ── Cleanup: the provisioned WorkOS user must not accumulate ────
    try {
      const workos = new WorkOS(workosApiKey);
      const users = await workos.userManagement.listUsers({
        email: INVITEE_EMAIL,
      });
      const user = users.data[0];
      if (user !== undefined) {
        inviteeWorkosUserId = user.id;
        await workos.userManagement.deleteUser(user.id);
      }
    } catch (err) {
      console.error(
        `[invite-flow] WorkOS cleanup failed for ${INVITEE_EMAIL} (${inviteeWorkosUserId ?? "unresolved"}):`,
        err,
      );
    }
    await adminContext.close();
    await inviteeContext.close();
  }
});
