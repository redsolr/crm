/**
 * Stripe v2 idempotency-key minting.
 *
 * Every POST / PUT / PATCH / DELETE in the handwritten API clients
 * accepts an optional `idempotencyKey: string = freshIdempotencyKey()`
 * parameter and forwards it as the `Idempotency-Key` request header.
 *
 * Stripe v2 replay window is 30 days; the BE platform mirrors that
 * (see `platform/docs/platform/api-discipline.md` § B3). Generate a
 * fresh key per call by default; callers wrapping their own retry
 * loop pass an explicit key to dedupe across attempts.
 *
 * One source of truth lives here so the helper isn't duplicated 23×
 * across `workItemsApi.ts`, `pagesApi.ts`, etc.
 */
export function freshIdempotencyKey(): string {
  return crypto.randomUUID();
}
