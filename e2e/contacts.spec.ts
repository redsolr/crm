/**
 * Contacts + attribute-enrichment E2E (Tier 1 — mocked).
 *
 * 1) Contacts view: empty state → create a contact (name, company link,
 *    email, decision role) → row renders with avatar, mailto link, and
 *    the decision-role tag.
 * 2) AI-computed column: on the account detail page the `icp_fit`
 *    definition (carries an `enrichment` config in the mock, mirroring
 *    the platform template) shows the ✨ Compute button; clicking it
 *    fills the value with computed provenance (AI tag). A subsequent
 *    manual write resets provenance and a re-compute is skipped loudly
 *    (`skipped_manual_override` — the platform's no-clobber contract).
 */

import { test, expect } from "./fixtures/auth.fixture";
import { setupSalesHandlers } from "./handlers/sales.handlers";
import {
  STEP_TIMEOUT,
  openFullViewViaPeek,
  createAccountViaUi,
} from "./helpers/sales-ui";

test.describe("Contacts", () => {
  test("create a contact and see it in the list", async ({ authedPage }) => {
    await setupSalesHandlers(authedPage);

    // Seed one company so the contact can be linked to it.
    await authedPage.goto("/sales");
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await createAccountViaUi(authedPage, "Baker & Partners");

    await authedPage.goto("/sales/contacts");
    await expect(
      authedPage.getByTestId("sales-contacts-empty"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    await authedPage.getByTestId("sales-add-contact-button").click();
    await authedPage
      .getByTestId("sales-contact-first-name-input")
      .fill("Somchai");
    await authedPage
      .getByTestId("sales-contact-last-name-input")
      .fill("Prasert");
    await authedPage
      .getByTestId("sales-contact-account-select")
      .selectOption({ label: "Baker & Partners" });
    await authedPage
      .getByTestId("sales-contact-email-input")
      .fill("somchai@firm.co.th");
    await authedPage
      .getByTestId("sales-contact-decision-role-select")
      .selectOption("decision_maker");
    await authedPage
      .getByRole("button", { name: "Create contact" })
      .click();

    const row = authedPage.getByTestId("sales-contacts-row");
    await expect(row).toHaveCount(1, { timeout: STEP_TIMEOUT });
    await expect(row).toContainText("Somchai Prasert");
    await expect(row).toContainText("Baker & Partners");
    await expect(
      row.locator('a[href="mailto:somchai@firm.co.th"]'),
    ).toBeVisible();
    await expect(row).toContainText("decision maker");
    await expect(
      row.getByTestId("crm-person-avatar"),
    ).toBeVisible();
  });
});

test.describe("AI-computed columns (attribute enrichment)", () => {
  test("compute fills icp_fit with provenance; manual write is never clobbered", async ({
    authedPage,
  }) => {
    await setupSalesHandlers(authedPage);

    await authedPage.goto("/sales");
    await expect(
      authedPage.getByTestId("sales-empty-primary-cta"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    await createAccountViaUi(authedPage, "Lex Siam");

    // Companies → peek → expand to the account detail page.
    await authedPage.goto("/sales/companies");
    await openFullViewViaPeek(
      authedPage,
      authedPage.getByTestId("sales-companies-cell-company").first(),
    );
    await expect(
      authedPage.getByTestId("sales-account-detail"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // ✨ Compute → mock returns the first option ("strong") with
    // computed provenance → AI tag appears.
    await authedPage.getByTestId("sales-attr-icp_fit-compute").click();
    await expect(
      authedPage.getByTestId("sales-account-attr-icp_fit"),
    ).toHaveValue("strong", { timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-attr-icp_fit-ai-tag"),
    ).toBeVisible({ timeout: STEP_TIMEOUT });

    // Human overrides → provenance resets to manual (AI tag gone).
    await authedPage
      .getByTestId("sales-account-attr-icp_fit")
      .selectOption("moderate");
    await expect(
      authedPage.getByTestId("sales-attr-icp_fit-ai-tag"),
    ).toHaveCount(0, { timeout: STEP_TIMEOUT });

    // Re-compute is a loud no-op skip — value stays the human's.
    await authedPage.getByTestId("sales-attr-icp_fit-compute").click();
    await expect(
      authedPage.getByTestId("sales-attr-icp_fit-compute-note"),
    ).toContainText("Kept your manual value", { timeout: STEP_TIMEOUT });
    await expect(
      authedPage.getByTestId("sales-account-attr-icp_fit"),
    ).toHaveValue("moderate");
  });
});
