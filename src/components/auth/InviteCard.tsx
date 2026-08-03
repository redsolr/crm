"use client";

import { useState, useTransition } from "react";
import { PasswordInput } from "./PasswordInput";
import { FieldError } from "./FieldError";
import { SubmitButton } from "./SubmitButton";
import { AuthDivider } from "./AuthDivider";
import { GoogleIcon } from "./SocialButton";

/**
 * The owned invite-accept card — replaces the WorkOS-hosted "Accept
 * invitation" screen entirely. Part of the auth kit: everything
 * product-specific (name, invite data, accept calls) arrives via props
 * so this file copies byte-identical into sibling apps (the Jurisimus
 * web-app points the same card at the platform's invite endpoints).
 *
 * Two accept paths, mirroring the login card's affordances:
 * - Continue with Google — `onOAuth` runs the accept call (provisions
 *   the seat) and resolves to the OAuth URL to follow.
 * - Set a password — inline name+password form; `onPassword` provisions
 *   + signs in server-side and resolves to the in-app destination.
 */

export interface InviteCardInvite {
  email: string;
  invited_by_name: string | null;
  expires_at: string;
}

export function InviteCard({
  productName,
  invite,
  onOAuth,
  onPassword,
}: {
  /** Shown in the headline — "join <productName>". */
  productName: string;
  invite: InviteCardInvite;
  /** Accept for a provider sign-in; resolves to the URL to navigate to. */
  onOAuth: () => Promise<{ next?: string; error?: string }>;
  /** Accept with a chosen password; resolves to the in-app destination. */
  onPassword: (fields: {
    first_name: string;
    last_name: string;
    password: string;
  }) => Promise<{ next?: string; error?: string }>;
}) {
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isPending, startTransition] = useTransition();
  // Sticky through the redirect so buttons never un-pend on screen.
  const [navigating, setNavigating] = useState(false);
  const busy = isPending || navigating;

  function continueWithGoogle() {
    setError("");
    startTransition(async () => {
      const result = await onOAuth();
      if (result.next !== undefined) {
        setNavigating(true);
        window.location.href = result.next;
      } else {
        setError(result.error ?? "Could not accept the invite — try again.");
      }
    });
  }

  function handlePasswordSubmit(formData: FormData) {
    const password = (formData.get("password") as string) ?? "";
    if (password.length < 10) {
      setPasswordError("Password must be at least 10 characters.");
      return;
    }
    setPasswordError("");
    setError("");
    startTransition(async () => {
      const result = await onPassword({
        first_name: ((formData.get("first_name") as string) ?? "").trim(),
        last_name: ((formData.get("last_name") as string) ?? "").trim(),
        password,
      });
      if (result.next !== undefined) {
        setNavigating(true);
        window.location.href = result.next;
      } else {
        setError(result.error ?? "Could not accept the invite — try again.");
      }
    });
  }

  return (
    <>
      <div className="invite-card-header mb-8" data-testid="invite-card">
        <h1
          className="invite-card-title text-ctx-primary text-[26px] font-bold"
          data-testid="invite-title"
        >
          Join {productName}
        </h1>
        <p className="invite-card-subtitle text-ctx-body text-[15px] mt-2 opacity-80">
          {invite.invited_by_name !== null && invite.invited_by_name !== ""
            ? `${invite.invited_by_name} invited you`
            : "You’ve been invited"}{" "}
          as{" "}
          <span
            className="text-ctx-primary font-semibold"
            data-testid="invite-email"
          >
            {invite.email}
          </span>
        </p>
      </div>

      {error !== "" && <FieldError message={error} testId="invite-error" />}

      <div className="invite-card-oauth mt-4">
        <button
          type="button"
          onClick={continueWithGoogle}
          disabled={busy}
          className="auth-social-btn w-full py-3 px-4 bg-white font-medium text-[15px] rounded-full transition-all hover:shadow-sm flex items-center justify-center gap-3 cursor-pointer border border-ctx-line disabled:opacity-60"
          data-testid="invite-btn-google"
        >
          <GoogleIcon />
          <span className="text-ctx-primary">Continue with Google</span>
        </button>
      </div>

      <AuthDivider />

      <form
        // onSubmit (not `action={}`): React 19 auto-resets uncontrolled
        // fields when a form action settles — same flash bug class the
        // login card documents.
        onSubmit={(e) => {
          e.preventDefault();
          handlePasswordSubmit(new FormData(e.currentTarget));
        }}
        className="invite-card-form space-y-4"
        data-testid="invite-password-form"
      >
        <div className="invite-card-names flex gap-3">
          <div className="flex-1">
            <label className="ctx-label">First name</label>
            <input
              name="first_name"
              type="text"
              className="ctx-input"
              data-testid="invite-first-name"
            />
          </div>
          <div className="flex-1">
            <label className="ctx-label">Last name</label>
            <input
              name="last_name"
              type="text"
              className="ctx-input"
              data-testid="invite-last-name"
            />
          </div>
        </div>

        <PasswordInput
          name="password"
          error={passwordError || undefined}
          onChange={() => setPasswordError("")}
          testId="invite-password-input"
        />

        <SubmitButton
          isPending={busy}
          label="Create account"
          pendingLabel="Joining..."
          data-testid="invite-submit"
        />
      </form>
    </>
  );
}
