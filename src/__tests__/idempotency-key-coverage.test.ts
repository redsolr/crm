/**
 * Idempotency-Key coverage ratchet.
 *
 * Walks every TS/TSX file under `src/` and finds every platform write
 * call (`POST` / `PUT` / `PATCH` / `DELETE` to `BaseApiClient.request`
 * or raw `fetch` with an `API_ROOT` / `API_BASE` / `baseUrl` token).
 * Each write must include an `Idempotency-Key` header in its options
 * object, OR the call must be on a path the backend explicitly
 * exempts (SSE streams, OAuth bypass routes, webhook receivers).
 *
 * **Why this exists.** GPT round-3 cross-check noted that Stripe v2
 * idempotency is the platform standard for writes, and that an FE
 * call missing the header gets logged as `idempotency.missing_key`
 * server-side. This ratchet catches FE writes that forgot the header
 * before they ship — closing the loop the BE can only complain about
 * after the fact.
 *
 * Mirrors the structural patterns from `public-api-coverage.test.ts`:
 * AST walker over `fetch(...)` and `this.request(...)` / `this.requestUnprefixed(...)`,
 * plus a structured `IDEMPOTENCY_EXEMPTIONS` allowlist for routes the
 * backend doesn't dedupe (kept in lockstep with
 * `platform/src/common/interceptors/idempotency.interceptor.ts`'s
 * `EXEMPT_PATH_PREFIXES`).
 */
import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import * as ts from "typescript";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC_ROOT = resolve(REPO_ROOT, "src");

const SKIP_PATH_SEGMENTS = [
  "__tests__",
  "/generated/",
  "node_modules",
  ".next",
];

/**
 * Path prefixes the backend exempts from idempotency processing —
 * mirrored from `platform/src/common/interceptors/idempotency.interceptor.ts`
 * `EXEMPT_PATH_PREFIXES`. A call to one of these may legitimately omit
 * `Idempotency-Key`. Keep this list in sync — drift here would either
 * fail FE writes that the BE actually accepts, or pass FE writes that
 * the BE logs as `idempotency.missing_key`.
 */
const IDEMPOTENCY_EXEMPTIONS: ReadonlyArray<{
  match: string;
  mode: "exact" | "prefix";
  reason: string;
}> = [
  // SSE streaming — replays would re-stream cached bytes; the
  // backend interceptor short-circuits these via path prefix and
  // Content-Type. `/api/chats/{}/responses` is the public native
  // streaming endpoint (chat-surface-design.md § 2); it has its
  // own service-level idempotency on `Idempotency-Key` (§ 9), so a
  // dev who wants transparent retries supplies the key themselves.
  // The legacy `/chat/stream` consumer-app endpoint stays exempt
  // for first-party flows that still use it server-side.
  {
    match: "/api/chats/{}/responses",
    mode: "prefix",
    reason:
      "SSE — replay re-streams cached bytes; service-level Idempotency-Key opt-in",
  },
  {
    match: "/api/chat/stream",
    mode: "prefix",
    reason: "SSE — replay re-streams cached bytes; BE interceptor exempts",
  },
  {
    match: "/chat/stream",
    mode: "prefix",
    reason: "Pre-prefix SSE form (BE interceptor exempts)",
  },
  // OAuth 2.1 + WorkOS bridge — RFC-shaped endpoints; replay semantics
  // are spec-defined (grant_type, refresh_token rotation).
  {
    match: "/auth/",
    mode: "prefix",
    reason: "OAuth/RFC endpoints — spec-defined replay semantics",
  },
  // Inbound vendor webhooks — receivers verify signatures + track their
  // own delivery ids; an Idempotency-Key from the platform side has no
  // meaning. (FE never CALLs these, only the BE receives — included
  // for completeness with the interceptor's list.)
  {
    match: "/webhooks/",
    mode: "prefix",
    reason: "Inbound vendor webhooks — sender-controlled dedupe",
  },
  // Health / liveness probes — infra surfaces.
  {
    match: "/health",
    mode: "prefix",
    reason: "Health/liveness probes — infra, not platform writes",
  },
  // Dev-only login bypass.
  {
    match: "/auth/dev/login",
    mode: "exact",
    reason: "Dev-only login bypass; never in production",
  },
];

interface WriteCallSite {
  readonly file: string;
  readonly line: number;
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly resolvedPath: string | null;
  readonly hasIdempotencyKey: boolean;
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  function visit(dir: string): void {
    const entries = readdirSync(dir);
    for (const e of entries) {
      const full = join(dir, e);
      const skip = SKIP_PATH_SEGMENTS.some((seg) =>
        full.includes(seg.replace(/\//g, "\\")) || full.includes(seg),
      );
      if (skip) continue;
      const info = statSync(full);
      if (info.isDirectory()) {
        visit(full);
      } else if (
        e.endsWith(".ts") ||
        e.endsWith(".tsx") ||
        e.endsWith(".mts") ||
        e.endsWith(".cts")
      ) {
        out.push(full);
      }
    }
  }
  visit(root);
  return out;
}

function pathMatchesExemption(path: string): boolean {
  for (const ex of IDEMPOTENCY_EXEMPTIONS) {
    if (ex.mode === "exact" && path === ex.match) return true;
    if (ex.mode === "prefix" && path.startsWith(ex.match)) return true;
  }
  return false;
}

function objectLiteralHasIdempotencyKey(
  expr: ts.Expression | undefined,
): boolean {
  if (expr === undefined || !ts.isObjectLiteralExpression(expr)) return false;
  for (const prop of expr.properties) {
    // Look for `headers: { ... }` — the headers object lives there.
    if (
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === "headers" &&
      ts.isObjectLiteralExpression(prop.initializer)
    ) {
      for (const h of prop.initializer.properties) {
        if (
          ts.isPropertyAssignment(h) &&
          ((ts.isStringLiteral(h.name) && h.name.text === "Idempotency-Key") ||
            (ts.isIdentifier(h.name) && h.name.text === "Idempotency-Key"))
        ) {
          return true;
        }
      }
    }
    // Inline spread of authService.getAuthHeaders() etc. — those don't
    // carry idempotency. The header must be set explicitly on the
    // headers object alongside any spreads.
  }
  return false;
}

function resolveTemplatePath(
  expr: ts.Expression,
  isUnprefixedRequest = false,
): { path: string | null; isPlatform: boolean } {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    // Bare string used with `this.request("/path", ...)` is a platform
    // call (BaseApiClient adds `/api`). With `requestUnprefixed`, no
    // prefix added.
    return {
      path: isUnprefixedRequest ? expr.text : `/api${expr.text}`,
      isPlatform: true,
    };
  }
  if (ts.isTemplateExpression(expr)) {
    let s = expr.head.text;
    let isPlatform = false;
    let inferredPrefix = "";
    for (const span of expr.templateSpans) {
      const exprText =
        ts.isIdentifier(span.expression) || ts.isPropertyAccessExpression(span.expression)
          ? ts.isIdentifier(span.expression)
            ? span.expression.text
            : span.expression.name.text
          : null;
      if (exprText === "API_ROOT" || exprText === "baseUrl") {
        s += "/api";
        isPlatform = true;
        inferredPrefix = "/api";
      } else if (exprText === "API_BASE") {
        isPlatform = true;
      } else {
        s += "{}";
      }
      s += span.literal.text;
    }
    if (!isPlatform) return { path: null, isPlatform: false };
    void inferredPrefix;
    return { path: s, isPlatform: true };
  }
  return { path: null, isPlatform: false };
}

function scanFile(filePath: string): WriteCallSite[] {
  const sourceText = readFileSync(filePath, "utf8");
  const sf = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.Unknown,
  );
  const sites: WriteCallSite[] = [];

  function lineOf(node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  }

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      // fetch(url, options?)
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "fetch" &&
        node.arguments[0] !== undefined
      ) {
        const optionsArg = node.arguments[1];
        const method = extractMethod(optionsArg);
        if (method != null) {
          const { path, isPlatform } = resolveTemplatePath(node.arguments[0]);
          if (isPlatform) {
            sites.push({
              file: relative(REPO_ROOT, filePath).replace(/\\/g, "/"),
              line: lineOf(node),
              method,
              resolvedPath: path,
              hasIdempotencyKey: objectLiteralHasIdempotencyKey(optionsArg),
            });
          }
        }
      }
      // this.request(url, options?) / this.requestUnprefixed(url, options?)
      else if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
        (node.expression.name.text === "request" ||
          node.expression.name.text === "requestUnprefixed") &&
        node.arguments[0] !== undefined
      ) {
        const optionsArg = node.arguments[1];
        const method = extractMethod(optionsArg);
        if (method != null) {
          const isUnprefixed = node.expression.name.text === "requestUnprefixed";
          const { path } = resolveTemplatePath(node.arguments[0], isUnprefixed);
          sites.push({
            file: relative(REPO_ROOT, filePath).replace(/\\/g, "/"),
            line: lineOf(node),
            method,
            resolvedPath: path,
            hasIdempotencyKey: objectLiteralHasIdempotencyKey(optionsArg),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return sites;
}

function extractMethod(
  optionsArg: ts.Expression | undefined,
): "POST" | "PUT" | "PATCH" | "DELETE" | null {
  if (optionsArg === undefined || !ts.isObjectLiteralExpression(optionsArg))
    return null;
  for (const prop of optionsArg.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === "method" &&
      (ts.isStringLiteral(prop.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(prop.initializer))
    ) {
      const m = prop.initializer.text.toUpperCase();
      if (m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") {
        return m;
      }
    }
  }
  return null;
}

describe("Idempotency-Key coverage", () => {
  it("every platform write call (POST/PUT/PATCH/DELETE) sets Idempotency-Key, or is on an exempt path", () => {
    const files = walkFiles(SRC_ROOT);
    const allSites: WriteCallSite[] = [];
    for (const f of files) {
      try {
        allSites.push(...scanFile(f));
      } catch (err) {
        // Skip files that fail to parse — e.g. partial syntax during
        // an in-progress edit. Don't let one broken file silently kill
        // coverage for the rest.
        console.warn(`[idempotency-key-coverage] skipped ${f}: ${err}`);
      }
    }

    const offenders = allSites.filter(
      (s) =>
        !s.hasIdempotencyKey &&
        (s.resolvedPath === null || !pathMatchesExemption(s.resolvedPath)),
    );

    if (offenders.length > 0) {
      const lines = offenders.map(
        (o) =>
          `  ${o.file}:${o.line}  ${o.method} ${o.resolvedPath ?? "<unresolved>"}`,
      );
      throw new Error(
        `Found ${offenders.length} platform write call(s) missing Idempotency-Key:\n${lines.join(
          "\n",
        )}\n\n` +
          "Platform standard is Stripe v2-style idempotency on every write. The backend's " +
          "`idempotency.interceptor.ts` honors the header on every non-exempt route — adding " +
          "it client-side is what makes transparent retries safe. Either:\n" +
          "  (a) set `\"Idempotency-Key\": freshIdempotencyKey()` in the headers object, OR\n" +
          "  (b) confirm the route is on the IDEMPOTENCY_EXEMPTIONS list above (and add it if not).",
      );
    }
  });
});
