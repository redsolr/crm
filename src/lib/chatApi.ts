/**
 * Backwards-compat shim for the old `@/lib/chatApi` import path.
 *
 * The real implementation lives under `./chat/` — split into focused
 * modules (breadcrumbs / schemas / types / stream / client / permissions).
 * External code still imports from `@/lib/chatApi`, so this file exists
 * only to forward the public surface from the new barrel.
 *
 * New code in this folder should import from `./chat` directly; new code
 * outside this folder should keep using `@/lib/chatApi` until we decide to
 * rename the public import path.
 */

export * from "./chat";
