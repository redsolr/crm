import { randomBytes } from "crypto";

/**
 * Prefixed-ID minting for the CRM's own Postgres, wire-compatible with
 * the platform's `<prefix>_<base58>` form (`wi_…`, `wfs_…`, `ad_…`, …)
 * so the untouched frontend keeps receiving IDs in the shape it already
 * handles. 16 random bytes ≈ UUID entropy.
 */

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// No BigInt literals — the project targets ES2017 (BigInt is available
// at runtime; only the `0n` literal syntax is gated on ES2020).
const BIG_ZERO = BigInt(0);
const BIG_BASE = BigInt(BASE58_ALPHABET.length);

function toBase58(bytes: Buffer): string {
  let value = BigInt(`0x${bytes.toString("hex")}`);
  let out = "";
  while (value > BIG_ZERO) {
    out = BASE58_ALPHABET[Number(value % BIG_BASE)] + out;
    value = value / BIG_BASE;
  }
  return out === "" ? BASE58_ALPHABET[0]! : out;
}

/** Mint a prefixed resource ID, e.g. `mintId("wi")` → `wi_4h6…`. */
export function mintId(prefix: string): string {
  return `${prefix}_${toBase58(randomBytes(16))}`;
}
