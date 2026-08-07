/**
 * API authorization coverage ratchet.
 *
 * **Why this exists.** On 2026-08-08 a probe of production found every
 * `/api/*` data route serving anonymous callers — reads returned real
 * records (including Ask chat history) and writes reached validation.
 * The cause was structural, not a typo: `currentActor()` FALLS BACK to
 * the local placeholder actor when there is no session (right for
 * attribution, fatal as an implicit authorization decision), and no
 * layer above the routes enforced anything — `proxy.ts` deliberately
 * runs with `middlewareAuth.enabled:false` because the CRM ships a
 * custom login UI. The repo even *documented* a guard that did not
 * exist, which is precisely how it drifted unnoticed for nine days.
 *
 * So the fix is not "add the check once" — it's "make the missing
 * check impossible to ship". Every exported route handler must call
 * `requireApiSession()` (see `src/server/api-auth.ts`), or appear on
 * the exemption list below WITH a reason. New routes fail this spec
 * until their author makes that choice explicitly.
 *
 * Mirrors the AST-walker shape of `idempotency-key-coverage.test.ts`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import * as ts from "typescript";

const REPO_ROOT = resolve(__dirname, "..", "..");
const API_ROOT = resolve(REPO_ROOT, "src", "app", "api");

const HANDLER_NAMES = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Routes that legitimately serve unauthenticated callers. Each carries
 * its OWN enforcement — never "we forgot". Adding a row here is a
 * security decision; state the enforcement, not just the intent.
 */
const EXEMPT_ROUTES: ReadonlyArray<{ path: string; enforcement: string }> = [
  {
    path: "mcp/[transport]/route.ts",
    enforcement:
      "OAuth 2.1 resource-server verification + CRM_MCP_TOKEN bearer (server/mcp-auth.ts); closed-by-default when neither is configured",
  },
  {
    path: "digest/run/route.ts",
    enforcement:
      "CRON_SECRET bearer, timing-safe compare; 503 when unset (Vercel cron caller has no session)",
  },
  {
    path: "invite/[code]/route.ts",
    enforcement:
      "PUBLIC BY DESIGN — the invitee has no account yet; the high-entropy invite code IS the credential",
  },
  {
    path: "invite/[code]/accept/route.ts",
    enforcement:
      "PUBLIC BY DESIGN — provisions the AuthKit user; the invite code is the credential, single-use + expiring",
  },
  {
    path: "realtime/session/route.ts",
    enforcement:
      "inline equivalent guard predating this seam: refuses the fallback actor outside MOCK_AUTH before minting a socket token",
  },
];

function walkRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkRouteFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

const relPath = (file: string) =>
  relative(API_ROOT, file).replace(/\\/g, "/");

/** Does this function body call `requireApiSession()` before anything
 *  that could touch data? We require it among the FIRST statements —
 *  a guard buried after a DB write is not a guard. */
function gatesEarly(body: ts.Block): boolean {
  const leading = body.statements.slice(0, 3);
  return leading.some((stmt) => {
    let found = false;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "requireApiSession"
      ) {
        found = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(stmt);
    return found;
  });
}

interface UngatedHandler {
  file: string;
  handler: string;
  line: number;
}

describe("API authorization coverage", () => {
  it("every route handler gates on requireApiSession, or is explicitly exempt", () => {
    const exemptPaths = new Set(EXEMPT_ROUTES.map((e) => e.path));
    const ungated: UngatedHandler[] = [];
    let checked = 0;

    for (const file of walkRouteFiles(API_ROOT)) {
      const rel = relPath(file);
      if (exemptPaths.has(rel)) continue;

      const sf = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
      );

      for (const stmt of sf.statements) {
        if (
          !ts.isFunctionDeclaration(stmt) ||
          stmt.name === undefined ||
          !HANDLER_NAMES.has(stmt.name.text) ||
          !stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          continue;
        }
        checked++;
        if (stmt.body === undefined || !gatesEarly(stmt.body)) {
          ungated.push({
            file: rel,
            handler: stmt.name.text,
            line:
              sf.getLineAndCharacterOfPosition(stmt.getStart()).line + 1,
          });
        }
      }
    }

    // Guard against the walker silently matching nothing (a refactor of
    // the route layout would otherwise make this spec vacuously pass).
    expect(checked).toBeGreaterThan(30);

    if (ungated.length > 0) {
      const lines = ungated.map(
        (u) => `  ${u.file}:${u.line}  ${u.handler}`,
      );
      throw new Error(
        `Found ${ungated.length} route handler(s) with no authorization gate:\n${lines.join("\n")}\n\n` +
          "Every /api handler must start with:\n" +
          "    const gate = await requireApiSession();\n" +
          "    if (!gate.ok) return gate.response;\n\n" +
          "…or the route must be added to EXEMPT_ROUTES above WITH the auth it enforces instead. " +
          "An ungated route serves the whole CRM to anonymous callers — that shipped once (2026-08-08); " +
          "this spec exists so it cannot ship twice.",
      );
    }
  });

  it("keeps every exemption justified", () => {
    for (const exempt of EXEMPT_ROUTES) {
      expect(exempt.enforcement.length).toBeGreaterThan(20);
      // The file must still exist — a stale exemption is a hole waiting
      // for a route to be recreated at the same path.
      expect(() =>
        statFileExists(join(API_ROOT, ...exempt.path.split("/"))),
      ).not.toThrow();
    }
  });
});

function statFileExists(path: string): void {
  statSync(path);
}
