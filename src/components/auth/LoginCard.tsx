"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useAuth } from "@/stores/use-auth";
import { PasswordInput } from "./PasswordInput";
import { FieldError } from "./FieldError";
import { SubmitButton } from "./SubmitButton";
import { SocialButton } from "./SocialButton";
import { AuthDivider } from "./AuthDivider";
import { ToggleSwitch } from "./ToggleSwitch";

/**
 * The complete sign-in card — email/password form, remember-me,
 * Google/Apple social buttons. Part of the auth kit: a product's login
 * page is just <LoginCard login={action} redirectTo="/home" /> inside
 * the (auth) layout's AuthShell; everything product-specific arrives
 * via props so this file stays byte-identical across repos.
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

  useEffect(() => {
    if (!loading && isAuthenticated) {
      window.location.href = needsOnboarding ? onboardingRedirect : redirectTo;
    }
  }, [isAuthenticated, loading, needsOnboarding, onboardingRedirect, redirectTo]);

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

      {/* Submitted via onSubmit, NOT `action={...}`: React 19 auto-resets
          uncontrolled fields when a form action completes, which blanked the
          email input and un-pended the button for the beat between the
          server action finishing and the hard nav committing — a
          successful login flashed like a broken/failed one. */}
      <form
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
