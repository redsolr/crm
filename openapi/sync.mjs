/**
 * Sync the public OpenAPI spec from the platform repo into this
 * repo's `openapi/` directory.
 *
 * The platform's spec is auto-generated from runtime Zod schemas +
 * drift-gated by CI on the platform side (`bun run openapi:check`
 * between linter and unit tests). This script just copies the artifact
 * in — we do not modify it.
 *
 * Usage:
 *   npm run openapi:sync
 *
 * Default source: `../platform/docs/public-api/openapi.yaml`.
 * Override with `OPENAPI_SOURCE=/abs/path/openapi.yaml`.
 */

import { copyFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const specSource =
  process.env.OPENAPI_SOURCE ??
  resolve(repoRoot, "..", "platform", "docs", "public-api", "openapi.yaml");
const specDestination = resolve(here, "openapi.yaml");

async function ensureFile(path, label) {
  try {
    const info = await stat(path);
    if (!info.isFile()) {
      throw new Error(`${label} is not a regular file: ${path}`);
    }
  } catch (err) {
    console.error(
      `[openapi:sync] cannot read ${label}: ${err instanceof Error ? err.message : String(err)}`,
    );
    console.error(
      `[openapi:sync] expected at ${path} — re-run \`bun run openapi:build\` in the platform first if this is a fresh clone`,
    );
    process.exit(1);
  }
}

await ensureFile(specSource, "OpenAPI spec");

await copyFile(specSource, specDestination);
console.log(`[openapi:sync] ${specSource} -> ${specDestination}`);
