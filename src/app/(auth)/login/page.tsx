import { LoginCard } from "@/components/auth/LoginCard";
import { LoginErrorBanner } from "@/components/auth/LoginErrorBanner";
import { LOGIN_ERROR_PARAM } from "@/lib/login-error";
import { CONNECT_CONTEXT_PARAM } from "@/server/connect";
import { emailPasswordLogin } from "./actions";

/**
 * Server component so the OAuth-callback error code (`?error=<code>`,
 * written by /callback on failure) renders as a banner without a
 * client useSearchParams/Suspense dance. The card itself stays the
 * shared client LoginCard.
 *
 * `?connect=1` (set by /login/connect — Standalone Connect) adds the
 * "sign in to authorize" context line: this visit exists to approve an
 * OAuth client (claude.ai, Cursor, …), not to enter the app.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorCode = params[LOGIN_ERROR_PARAM];
  const isConnectFlow = params[CONNECT_CONTEXT_PARAM] === "1";

  return (
    <>
      {typeof errorCode === "string" && errorCode !== "" && (
        <LoginErrorBanner code={errorCode} />
      )}
      {isConnectFlow && (
        <p
          className="login-connect-note mb-6 rounded-xl py-3 px-4 text-[14px] font-medium"
          style={{
            color: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.08)",
          }}
          data-testid="login-connect-note"
        >
          Sign in to authorize the app that sent you here — you&apos;ll be
          returned to it right after.
        </p>
      )}
      <LoginCard login={emailPasswordLogin} redirectTo="/sales" />
    </>
  );
}
