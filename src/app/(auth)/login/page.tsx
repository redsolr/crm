import { LoginCard } from "@/components/auth/LoginCard";
import { LoginErrorBanner } from "@/components/auth/LoginErrorBanner";
import { LOGIN_ERROR_PARAM } from "@/lib/login-error";
import { emailPasswordLogin } from "./actions";

/**
 * Server component so the OAuth-callback error code (`?error=<code>`,
 * written by /callback on failure) renders as a banner without a
 * client useSearchParams/Suspense dance. The card itself stays the
 * shared client LoginCard.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorCode = params[LOGIN_ERROR_PARAM];

  return (
    <>
      {typeof errorCode === "string" && errorCode !== "" && (
        <LoginErrorBanner code={errorCode} />
      )}
      <LoginCard login={emailPasswordLogin} redirectTo="/sales" />
    </>
  );
}
