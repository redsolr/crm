import {
  classifyLoginError,
  loginErrorMessage,
  LOGIN_ERROR_MESSAGES,
} from "@/lib/login-error";

describe("classifyLoginError", () => {
  it("maps sign-up-family codes to not_invited", () => {
    expect(classifyLoginError("sign_up_disabled")).toBe("not_invited");
    expect(classifyLoginError("signup_not_allowed")).toBe("not_invited");
    expect(classifyLoginError("invitation_required")).toBe("not_invited");
  });

  it("classifies on the description when the code is opaque", () => {
    expect(
      classifyLoginError(
        "access_denied",
        "Sign-ups are disabled for this environment.",
      ),
    ).toBe("not_invited");
    expect(
      classifyLoginError(undefined, "User must be invited to authenticate."),
    ).toBe("not_invited");
  });

  it("everything else is a generic auth failure", () => {
    expect(classifyLoginError("access_denied", "User denied consent")).toBe(
      "auth_failed",
    );
    expect(classifyLoginError("server_error")).toBe("auth_failed");
    expect(classifyLoginError()).toBe("auth_failed");
  });
});

describe("loginErrorMessage", () => {
  it("returns the mapped message for known codes", () => {
    expect(loginErrorMessage("not_invited")).toBe(
      LOGIN_ERROR_MESSAGES.not_invited,
    );
    expect(loginErrorMessage("auth_failed")).toBe(
      LOGIN_ERROR_MESSAGES.auth_failed,
    );
  });

  it("falls back to the generic message for unknown codes", () => {
    expect(loginErrorMessage("something_new")).toBe(
      LOGIN_ERROR_MESSAGES.auth_failed,
    );
  });
});
