"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import { useAuth } from "@/stores/use-auth";
import { readLastAccount, type LastAccount } from "@/lib/last-account";

// Hydration-safe cookie read: the server snapshot is null (no
// document.cookie during SSR), the client snapshot is read once and
// cached — the cookie only changes on a login, which navigates. The
// cache keeps the snapshot referentially stable, as
// useSyncExternalStore requires.
const subscribeNever = () => () => {};
let lastAccountSnapshot: LastAccount | null | undefined;
function readLastAccountCached(): LastAccount | null {
  lastAccountSnapshot ??= readLastAccount();
  return lastAccountSnapshot ?? null;
}
import { PasswordInput } from "./PasswordInput";
import { FieldError } from "./FieldError";
import { SubmitButton } from "./SubmitButton";
import { SocialButton } from "./SocialButton";
import { AuthDivider } from "./AuthDivider";
import { ToggleSwitch } from "./ToggleSwitch";
import { LastAccountCard } from "./LastAccountCard";

/**
 * The complete sign-in card — "Continue as <last account>" (when the
 * `crm-last-account` cookie remembers one), email/password form,
 * remember-me, Google/Apple social buttons. Part of the auth kit: a
 * product's login page is just <LoginCard login={action}
 * redirectTo="/home" /> inside the (auth) layout's AuthShell;
 * everything product-specific arrives via props so this file stays
 * byte-identical across repos.
 */
export function LoginCard({
  login,
  redirectTo,
  onboardingRedirect = "/onboarding",
  footer,
}: {
  /** Server action performing the email+password login. */
  login: (formData: FormData) => Promise<{ error?: string }>;
  /** Hard-navigation target after sign-in (the product's home). */
  redirectTo: string;
  /** Where an authenticated-but-unonboarded visitor is sent. */
  onboardingRedirect?: string;
  /** Optional slot under the social buttons (e.g. demo-request link). */
  footer?: React.ReactNode;
}) {
  const { isAuthenticated, loading, needsOnboarding } = useAuth();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [isPending, startTransition] = useTransition();
  // Stays true from successful auth until the hard navigation commits,
  // so the button never flips back to "Sign in" while the old document
  // is still on screen.
  const [redirecting, setRedirecting] = useState(false);
  // Read via external-store subscription — document.cookie doesn't
  // exist during SSR, so the server snapshot is null and the client
  // snapshot arrives on hydration without a setState-in-effect.
  const lastAccount = useSyncExternalStore(
    subscribeNever,
    readLastAccountCached,
    () => null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      window.location.href = needsOnboarding ? onboardingRedirect : redirectTo;
    }
  }, [isAuthenticated, loading, needsOnboarding, onboardingRedirect, redirectTo]);

  // Password-method "Continue as" — the account is already on file,
  // so drop the user straight at the only thing left to type.
  function continueWithPassword() {
    if (lastAccount === null) return;
    if (emailInputRef.current) {
      emailInputRef.current.value = lastAccount.email;
    }
    setFieldErrors((e) => ({ ...e, email: undefined }));
    formRef.current
      ?.querySelector<HTMLInputElement>('input[name="password"]')
      ?.focus();
  }

  function validateEmail(email: string): string | null {
    if (!email) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return `Invalid email address: ${email}`;
    return null;
  }

  function handleSubmit(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const errors: { email?: string; password?: string } = {};

    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("");
      return;
    }

    setFieldErrors({});
    setError("");
    startTransition(async () => {
      const result = await login(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setRedirecting(true);
        window.location.href = redirectTo;
      }
    });
  }

  return (
    <>
      <div className="login-card-header mb-8" data-testid="login-page">
        <h1
          className="login-card-title text-ctx-primary text-[26px] font-bold"
          data-testid="login-title"
        >
          Sign in to your account
        </h1>
      </div>

      {lastAccount !== null && (
        <>
          {/* No "Use another account" affordance (founder call
              2026-08-03): the full form + provider buttons sit right
              below, and any other login replaces the cookie. */}
          <LastAccountCard
            account={lastAccount}
            onContinueWithPassword={continueWithPassword}
          />
          <AuthDivider />
        </>
      )}

      {/* Submitted via onSubmit, NOT `action={...}`: React 19 auto-resets
          uncontrolled fields when a form action completes, which blanked the
          email input and un-pended the button for the beat between the
          server action finishing and the hard nav committing — a
          successful login flashed like a broken/failed one. */}
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(new FormData(e.currentTarget));
        }}
        className="login-card-form space-y-4"
        data-testid="login-email-form"
      >
        <div>
          <label className="ctx-label">Email</label>
          <input
            ref={emailInputRef}
            name="email"
            type="text"
            className={`ctx-input ${fieldErrors.email ? "ctx-input-error" : ""}`}
            onChange={() => setFieldErrors((e) => ({ ...e, email: undefined }))}
            data-testid="login-email-input"
          />
          {fieldErrors.email && (
            <FieldError
              message={fieldErrors.email}
              testId="login-email-error"
            />
          )}
        </div>

        <PasswordInput
          name="password"
          error={fieldErrors.password || error || undefined}
          onChange={() => {
            setFieldErrors((e) => ({ ...e, password: undefined }));
            setError("");
          }}
          testId="login-password-input"
          rightLabel={
            <Link
              href="/forgot-password"
              className="text-ctx-purple text-[13px] font-semibold"
            >
              Forgot your password?
            </Link>
          }
        />

        <ToggleSwitch
          name="remember"
          defaultChecked
          label={
            <span className="text-ctx-primary text-[13px] font-semibold">
              Remember me on this device
            </span>
          }
          data-testid="login-remember"
        />

        <SubmitButton
          isPending={isPending || redirecting}
          label="Sign in"
          pendingLabel="Signing in..."
          data-testid="login-submit"
        />
      </form>

      <AuthDivider />

      <div className="space-y-3">
        <SocialButton
          href="/login/google"
          provider="google"
          data-testid="login-btn-google"
        />
        <SocialButton
          href="/login/apple"
          provider="apple"
          data-testid="login-btn-apple"
        />
      </div>

      {footer}
    </>
  );
}
