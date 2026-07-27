/**
 * Shared port helpers for the two preflights that inspect who holds a
 * TCP port: `scripts/ensure-dev-port.mjs` (predev — reports the
 * occupant + kill command, never kills) and
 * `e2e/scripts/ensure-port-free.mjs` (pretest — kills; the suites own
 * the port). Extracted so the netstat/lsof parsing lives in one place.
 *
 * No dependencies — both consumers run as bare `node` npm hooks.
 */

import { execSync } from "node:child_process";

/** PIDs of processes LISTENING on `port` (empty array = port free). */
export function listeningPids(port) {
  const pids = new Set();
  try {
    if (process.platform === "win32") {
      const out = execSync(
        `netstat -ano -p tcp | findstr LISTENING | findstr :${port}`,
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      for (const line of out.split(/\r?\n/)) {
        const m = line
          .trim()
          .match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/);
        if (m && Number(m[1]) === port) pids.add(Number(m[2]));
      }
    } else {
      const out = execSync(`lsof -ti tcp:${port} -s tcp:listen`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of out.split(/\r?\n/)) {
        if (line.trim()) pids.add(Number(line.trim()));
      }
    }
  } catch {
    // Non-zero exit = no matches = port free. That's the happy path.
  }
  pids.delete(0); // PID 0 shows up for TIME_WAIT noise on Windows; never kill it.
  return [...pids];
}

/** Force-kill `pid` (and its process tree on Windows). True on success. */
export function kill(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
    return true;
  } catch {
    return false;
  }
}

/** Human-readable process name for `pid` ("unknown" if unresolvable). */
export function processName(pid) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const m = out.match(/^"([^"]+)"/);
      return m ? m[1] : "unknown";
    }
    return execSync(`ps -p ${pid} -o comm=`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}
