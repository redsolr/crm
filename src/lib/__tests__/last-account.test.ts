import {
  LAST_ACCOUNT_COOKIE,
  clearLastAccount,
  parseLastAccount,
  readLastAccount,
  serializeLastAccount,
} from "../last-account";

function clearCookie() {
  document.cookie = `${LAST_ACCOUNT_COOKIE}=; path=/; max-age=0`;
}

describe("last-account", () => {
  beforeEach(clearCookie);

  it("round-trips through serialize → cookie → read", () => {
    document.cookie = `${LAST_ACCOUNT_COOKIE}=${serializeLastAccount({
      email: "admin@jurisimus.com",
      name: "Kreethup Hiranphan",
      method: "GoogleOAuth",
    })}; path=/`;
    expect(readLastAccount()).toEqual({
      email: "admin@jurisimus.com",
      name: "Kreethup Hiranphan",
      method: "GoogleOAuth",
    });
  });

  it("returns null with no cookie set", () => {
    expect(readLastAccount()).toBeNull();
  });

  it("clearLastAccount removes the cookie", () => {
    document.cookie = `${LAST_ACCOUNT_COOKIE}=${serializeLastAccount({
      email: "admin@jurisimus.com",
    })}; path=/`;
    clearLastAccount();
    expect(readLastAccount()).toBeNull();
  });

  it("rejects malformed or email-less payloads", () => {
    expect(parseLastAccount("not-json")).toBeNull();
    expect(parseLastAccount(encodeURIComponent('"just a string"'))).toBeNull();
    expect(parseLastAccount(encodeURIComponent('{"name":"No Email"}'))).toBeNull();
    expect(parseLastAccount(encodeURIComponent('{"email":""}'))).toBeNull();
  });

  it("drops non-string optional fields instead of failing", () => {
    expect(
      parseLastAccount(
        encodeURIComponent('{"email":"a@b.co","name":42,"method":null}'),
      ),
    ).toEqual({ email: "a@b.co", name: undefined, method: undefined });
  });
});
