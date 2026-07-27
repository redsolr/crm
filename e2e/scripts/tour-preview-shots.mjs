/**
 * One-off design-review capture: screenshots each step of the guided-tour
 * preview harness (/dev/tour-preview). Not part of any test suite.
 *
 *   node e2e/scripts/tour-preview-shots.mjs [baseUrl]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.argv[2] ?? "http://localhost:3100";
const outDir = "e2e/screenshots/tour-preview";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// "networkidle" never settles against a dev server (HMR websocket stays
// open) — wait for the DOM and then the tour card itself.
await page.goto(`${baseUrl}/dev/tour-preview`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".tour-card", { timeout: 30000 });
// Let the aurora blobs and float animation settle into a pleasing frame
await page.waitForTimeout(1200);

const steps = 4;
for (let i = 0; i < steps; i++) {
  await page.screenshot({ path: `${outDir}/step-${i + 1}.png` });
  if (i < steps - 1) {
    await page.click(".tour-next-button");
    await page.waitForTimeout(700); // step transition
  }
}

await browser.close();
console.log(`Saved ${steps} screenshots to ${outDir}`);
