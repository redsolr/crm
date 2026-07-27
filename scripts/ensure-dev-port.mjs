/**
 * Dev-server preflight: crm-web is pinned to :3100 (ADR-001 — WorkOS
 * redirect URIs and backend CORS are registered against this port), so
 * `next dev --port 3100` must not silently fall back the way web-app's
 * portless `next dev` does. But Next's failure mode for a pinned port
 * is a raw EADDRINUSE stack with no owner and no remedy. This preflight
 * resolves who holds the port and prints the exact kill command.
 *
 * Deliberately does NOT kill (unlike e2e/scripts/ensure-port-free.mjs):
 * at dev time the occupant is usually a server someone started on
 * purpose — telling you what holds the port beats murdering it.
 *
 * No dependencies; wired as the `predev` / `predev:mock` npm hooks.
 */

import { listeningPids, processName } from "./port-utils.mjs";

const PORT = 3100;

const pids = listeningPids(PORT);
if (pids.length === 0) {
  process.exit(0);
}

console.error(`\n[dev preflight] Port ${PORT} is already in use:`);
for (const pid of pids) {
  console.error(`  PID ${pid} — ${processName(pid)}`);
}
console.error("\nKill it with:");
for (const pid of pids) {
  console.error(
    process.platform === "win32"
      ? `  taskkill /PID ${pid} /T /F`
      : `  kill -9 ${pid}`,
  );
}
console.error(
  `\n(crm-web must run on :${PORT} — auth redirects and CORS are registered against it, so no port fallback.)\n`,
);
process.exit(1);
