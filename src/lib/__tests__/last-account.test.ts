import {
  LAST_ACCOUNT_COOKIE,
  parseLastAccount,
  readLastAccount,
  serializeLastAccount,
} from "../last-account";

function clearCookie() {
  document.cookie = `${LAST_ACCOUNT_COOKIE}=; path=/; max-age=0`;
}

const ACCOUNT = {
  email: "admin@jurisimus.com",
  name: "Kreethup Hiranphan",
  method: "GoogleOAuth",
};

describe("last-account", () => {
  beforeEach(clearCookie);

  it("round-trips through serialize → Next cookie encoding → read", () => {
    // Next's ResponseCookies.set URL-encodes the value once; the
    // browser stores that encoded form verbatim. Mirror it here —
    // writing the raw serialize output would test a storage shape no
    // real browser ever holds.
    document.cookie = `${LAST_ACCOUNT_COOKIE}=${encodeURIComponent(
      serializeLastAccount(ACCOUNT),
    )}; path=/`;
    expect(readLastAccount()).toEqual(ACCOUNT);
  });

  it("serialize emits raw JSON — pre-encoding again would double-encode", () => {
    // Regression pin for the 2026-08-07 fix: serializeLastAccount must
    // NOT pre-encode, because Next's cookie serializer encodes the
    // value itself. JSON.parse-ability is the contract.
    expect(JSON.parse(serializeLastAccount(ACCOUNT))).toEqual(ACCOUNT);
  });

  it("still reads DOUBLE-encoded cookies written by historical builds", () => {
    // Before the fix the server pre-encoded and Next encoded again, so
    // prod browsers hold `%257B…`. Those cookies live for 180 days —
    // the parse must peel both layers.
    document.cookie = `${LAST_ACCOUNT_COOKIE}=${encodeURIComponent(
      encodeURIComponent(JSON.stringify(ACCOUNT)),
    )}; path=/`;
    expect(readLastAccount()).toEqual(ACCOUNT);
  });

  it("reads a plain single-encoded value", () => {
    expect(parseLastAccount(encodeURIComponent(JSON.stringify(ACCOUNT)))).toEqual(
      ACCOUNT,
    );
  });

  it("returns null with no cookie set", () => {
    expect(readLastAccount()).toBeNull();
  });

  it("rejects malformed or email-less payloads", () => {
    expect(parseLastAccount("not-json")).toBeNull();
    expect(parseLastAccount(encodeURIComponent('"just a string"'))).toBeNull();
    expect(parseLastAccount(encodeURIComponent('{"name":"No Email"}'))).toBeNull();
    expect(parseLastAccount(encodeURIComponent('{"email":""}'))).toBeNull();
    // Undecodable percent-sequence must not throw.
    expect(parseLastAccount("%E0%A4%A")).toBeNull();
  });

  it("drops non-string optional fields instead of failing", () => {
    expect(
      parseLastAccount(
        encodeURIComponent('{"email":"a@b.co","name":42,"method":null}'),
      ),
    ).toEqual({ email: "a@b.co", name: undefined, method: undefined });
  });
});
