/**
 * Onboarding E2E tests (Tier 1 — mocked).
 *
 * Tests the Slack-style onboarding wizard:
 *   Step 0: Welcome
 *   Step 1: Name your workspace  (→ creating-workspace animation → org create)
 *   Step 2: Your name (profile)
 *   Step 3: Invite teammates (skippable, with confirm modal)
 *   Step 4: Role selection (multi-select)
 *   Step 5: Interests (multi-select)
 *   Step 6: AI preferences (response length + tone) → celebration → welcome tabs
 */

import { test, expect } from "./fixtures/onboarding.fixture";
import type { Page } from "@playwright/test";

/** Click a visible button by its exact name. */
async function clickButton(page: Page, name: string) {
  await page.getByRole("button", { name }).click();
}

async function passWelcome(page: Page) {
  await page.getByTestId("onboarding-continue").click();
}

/** Fill the workspace name and trigger the create animation → profile. */
async function createWorkspace(page: Page) {
  await expect(page.getByText("Name your workspace")).toBeVisible();
  await page
    .getByPlaceholder("e.g. Hiranphan & Partners")
    .last()
    .fill("Hiranphan & Partners");
  await page.getByTestId("onboarding-continue").click();
  // Creating animation plays, then the profile step appears.
  await expect(page.getByText("What’s your name?")).toBeVisible({
    timeout: 10000,
  });
}

/**
 * Navigate from welcome through to a given step index.
 * 0=welcome, 1=workspace, 2=profile, 3=invite, 4=role, 5=interests, 6=preferences
 */
async function navigateToStep(page: Page, targetStep: number) {
  await page.goto("/onboarding");
  await expect(page.getByText("Welcome to Jurisimus")).toBeVisible({
    timeout: 10000,
  });

  if (targetStep >= 1) await passWelcome(page);
  if (targetStep >= 2) await createWorkspace(page);
  // Profile step — type a name (prefill isn't guaranteed), then continue.
  if (targetStep >= 3) {
    await page
      .getByPlaceholder("e.g. Kreethup Hiranphan")
      .last()
      .fill("Kreethup Hiranphan");
    await page.getByTestId("onboarding-continue").click();
  }
  // Invite → continue (don't skip) into personalization.
  if (targetStep >= 4) {
    await expect(page.getByText("Invite your teammates")).toBeVisible();
    await page.getByTestId("onboarding-continue").click();
  }
  if (targetStep >= 5) {
    await expect(
      page.getByText("What best describes your role?"),
    ).toBeVisible();
    await clickButton(page, "Software Engineer");
    await page.getByTestId("onboarding-continue").click();
  }
  if (targetStep >= 6) {
    await expect(page.getByText("What are you interested in?")).toBeVisible();
    await clickButton(page, "Coding & technical help");
    await page.getByTestId("onboarding-continue").click();
  }
}

test.describe("Onboarding Wizard", () => {
  // ── Welcome step ──

  test("renders welcome step first", async ({ onboardingPage }) => {
    await onboardingPage.goto("/onboarding");

    await expect(onboardingPage.getByText("Welcome to Jurisimus")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      onboardingPage.getByTestId("onboarding-continue"),
    ).toContainText("Let’s go");
  });

  test("no back button or step dots on welcome step", async ({
    onboardingPage,
  }) => {
    await onboardingPage.goto("/onboarding");

    await expect(onboardingPage.getByText("Welcome to Jurisimus")).toBeVisible({
      timeout: 10000,
    });
    await expect(onboardingPage.getByText("Back")).not.toBeVisible();
    await expect(onboardingPage.locator(".onboarding-step-dot")).toHaveCount(0);
  });

  // ── Workspace step ──

  test("advances to workspace step after welcome", async ({
    onboardingPage,
  }) => {
    await navigateToStep(onboardingPage, 1);

    await expect(onboardingPage.getByText("Name your workspace")).toBeVisible();
    await expect(
      onboardingPage.getByText("Workspace name").last(),
    ).toBeVisible();
  });

  test("shows six step indicator dots after welcome", async ({
    onboardingPage,
  }) => {
    await navigateToStep(onboardingPage, 1);

    await expect(onboardingPage.locator(".onboarding-step-dot")).toHaveCount(6);
  });

  test("workspace step is not skippable and gates on a name", async ({
    onboardingPage,
  }) => {
    await navigateToStep(onboardingPage, 1);

    await expect(onboardingPage.getByText("Skip for now")).not.toBeVisible();
    await expect(
      onboardingPage.getByTestId("onboarding-continue"),
    ).toHaveClass(/opacity-50/);
  });

  // ── Profile + invite steps ──

  test("creates workspace then lands on the profile step", async ({
    onboardingPage,
  }) => {
    await navigateToStep(onboardingPage, 2);

    await expect(onboardingPage.getByText("What’s your name?")).toBeVisible();
  });

  test("advances to the invite step (skippable)", async ({
    onboardingPage,
  }) => {
    await navigateToStep(onboardingPage, 3);

    await expect(
      onboardingPage.getByText("Invite your teammates"),
    ).toBeVisible();
    await expect(
      onboardingPage.getByRole("button", { name: "Copy invite link" }),
    ).toBeVisible();
    await expect(onboardingPage.getByText("Skip for now")).toBeVisible();
  });

  test("skipping invite shows a confirm modal", async ({ onboardingPage }) => {
    await navigateToStep(onboardingPage, 3);

    await onboardingPage.getByText("Skip for now").click();
    await expect(
      onboardingPage.getByText("Skip without inviting?"),
    ).toBeVisible();
  });

  // ── Role step ──

  test("advances to role step after invite", async ({ onboardingPage }) => {
    await navigateToStep(onboardingPage, 4);

    await expect(
      onboardingPage.getByText("What best describes your role?"),
    ).toBeVisible();
    await expect(
      onboardingPage.getByRole("button", { name: "Attorney" }),
    ).toBeVisible();
  });

  test("continue is disabled until a role is selected", async ({
    onboardingPage,
  }) => {
    await navigateToStep(onboardingPage, 4);

    await expect(
      onboardingPage.getByTestId("onboarding-continue"),
    ).toHaveClass(/opacity-50/);
  });

  test("can select multiple roles", async ({ onboardingPage }) => {
    await navigateToStep(onboardingPage, 4);

    await clickButton(onboardingPage, "Software Engineer");
    await clickButton(onboardingPage, "Researcher");

    await expect(
      onboardingPage.getByRole("button", { name: "Software Engineer" }),
    ).toHaveClass(/FF385C/);
    await expect(
      onboardingPage.getByTestId("onboarding-continue"),
    ).not.toHaveClass(/opacity-50/);
  });

  // ── Interests + preferences ──

  test("advances to interests step", async ({ onboardingPage }) => {
    await navigateToStep(onboardingPage, 5);

    await expect(
      onboardingPage.getByText("What are you interested in?"),
    ).toBeVisible();
  });

  test("preferences shows defaults and a Finish button", async ({
    onboardingPage,
  }) => {
    await navigateToStep(onboardingPage, 6);

    await expect(
      onboardingPage.getByText("How should the AI respond?"),
    ).toBeVisible();
    await expect(
      onboardingPage.getByRole("button", { name: "Balanced" }),
    ).toHaveClass(/FF385C/);
    await expect(
      onboardingPage.getByTestId("onboarding-continue"),
    ).toContainText("Finish");
  });

  // ── Celebration → welcome tabs → app ──

  test("finishing shows the celebration, then enters the app", async ({
    onboardingPage,
  }) => {
    await navigateToStep(onboardingPage, 6);

    await onboardingPage.getByTestId("onboarding-continue").click();

    await expect(onboardingPage.getByText(/is ready/)).toBeVisible({
      timeout: 10000,
    });
    await onboardingPage
      .getByRole("button", { name: "Continue with Free" })
      .click();

    // Welcome tabs carousel — skip straight into the app.
    await onboardingPage.getByRole("button", { name: "Skip" }).click();
    await onboardingPage.waitForURL("**/sales", { timeout: 10000 });
    await expect(onboardingPage).toHaveURL(/\/sales/);
  });

  // ── Navigation ──

  test("back button navigates to the previous step", async ({
    onboardingPage,
  }) => {
    await navigateToStep(onboardingPage, 4);

    await onboardingPage.getByText("Back").click();
    await expect(
      onboardingPage.getByText("Invite your teammates"),
    ).toBeVisible();
  });
});
