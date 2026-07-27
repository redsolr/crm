/**
 * Preflight for the e2e suites: make sure the suite's port is actually
 * free before Playwright boots its web server.
 *
 * Why this exists (2026-06-12, inherited from web-app): with
 * `reuseExistingServer` OFF (see playwright.config.ts), reused servers
 * caused mid-suite mass failures — most notably Windows process-tree
 * kills orphaning the previous run's next-server child, which kept the
 * port for minutes and then died mid-run. With reuse off, ANY occupant
 * would only make Playwright error out, so the preflight kills it.
 *
 * Since 2026-07-19 the suites own :3190 (NOT the dev server's :3100 —
 * the e2e server also builds into .next-e2e so both can run at once),
 * so the only thing this ever kills is a zombie from a previous run.
 *
 * No dependencies; wired as `pretest:e2e*` npm hooks.
 */

import { listeningPids, kill } from "../../scripts/port-utils.mjs";

const PORT = process.env.E2E_WEB_PORT ? Number(process.env.E2E_WEB_PORT) : 3190;

const pids = listeningPids(PORT);
if (pids.length === 0) {
  process.exit(0);
}

for (const pid of pids) {
  const ok = kill(pid);
  console.log(
    `[e2e preflight] :${PORT} was held by PID ${pid} — ${ok ? "killed (tests own this port; a dev server belongs on :3100)" : "FAILED to kill; the Playwright web server will not start"}`,
  );
}

// Give the OS a moment to release the socket before Playwright binds it.
await new Promise((resolve) => setTimeout(resolve, 1500));

const leftover = listeningPids(PORT);
if (leftover.length > 0) {
  console.error(`[e2e preflight] :${PORT} is still held by PID(s) ${leftover.join(", ")} — aborting.`);
  process.exit(1);
}
