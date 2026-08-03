"use client";

/**
 * "Continue as <last account>" — the OpenAI-platform login pattern:
 * the account that signed in last is offered back as a one-click
 * card above the form, with the sign-in method it used. OAuth
 * methods render as links into the provider route (with
 * `login_hint` so the provider preselects the account); password
 * (or unknown) methods hand control back to the form via
 * `onContinueWithPassword` (prefill email, focus password).
 *
 * Part of the auth kit — everything arrives via props; the cookie
 * read/clear lives with the caller (LoginCard).
 */

import type { LastAccount } from "@/lib/last-account";
import { GoogleIcon, AppleIcon } from "./SocialButton";

interface LastAccountCardProps {
  account: LastAccount;
  onContinueWithPassword: () => void;
}

function methodLabel(method: string | undefined): string {
  switch (method) {
    case "GoogleOAuth":
      return "Continue with Google";
    case "AppleOAuth":
      return "Continue with Apple";
    default:
      return "Continue with password";
  }
}

/** Right-edge affordance: the provider's icon + a chevron — the card
 *  itself is the button, so no grey helper text competing with the
 *  form (founder feedback 2026-08-03: the label read as disabled). */
function MethodBadge({ method }: { method: string | undefined }) {
  return (
    <span className="last-account-method flex-shrink-0 flex items-center gap-2 text-ctx-muted">
      {method === "GoogleOAuth" ? (
        <GoogleIcon />
      ) : method === "AppleOAuth" ? (
        <AppleIcon />
      ) : null}
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </span>
  );
}

function oauthHref(account: LastAccount): string | null {
  const hint = `login_hint=${encodeURIComponent(account.email)}`;
  switch (account.method) {
    case "GoogleOAuth":
      return `/login/google?${hint}`;
    case "AppleOAuth":
      return `/login/apple?${hint}`;
    default:
      return null;
  }
}

export function LastAccountCard({
  account,
  onContinueWithPassword,
}: LastAccountCardProps) {
  const href = oauthHref(account);
  const label = `${methodLabel(account.method)} as ${account.email}`;
  const body = (
    <>
      <span
        className="last-account-avatar w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-[17px]"
        style={{
          background:
            "var(--ctx-accent-gradient, linear-gradient(135deg, #FF385C 0%, #E61E4D 50%, #D70466 100%))",
        }}
        aria-hidden
      >
        {(account.name ?? account.email).charAt(0).toUpperCase()}
      </span>
      <span className="last-account-identity flex-1 min-w-0 text-left">
        {account.name && (
          <span className="last-account-name block truncate text-ctx-primary text-[15px] font-semibold">
            {account.name}
          </span>
        )}
        <span className="last-account-email block truncate text-ctx-muted text-[13px]">
          {account.email}
        </span>
      </span>
      <MethodBadge method={account.method} />
    </>
  );

  const cardClass =
    "last-account-card w-full py-3 px-4 bg-white rounded-xl border border-ctx-line flex items-center gap-3 cursor-pointer transition-all hover:shadow-md hover:border-ctx-purple/40";

  return (
    <div className="last-account mb-6" data-testid="login-last-account">
      {href !== null ? (
        <a
          href={href}
          className={cardClass}
          aria-label={label}
          title={label}
          data-testid="login-last-account-continue"
        >
          {body}
        </a>
      ) : (
        <button
          type="button"
          className={cardClass}
          aria-label={label}
          title={label}
          data-testid="login-last-account-continue"
          onClick={onContinueWithPassword}
        >
          {body}
        </button>
      )}
    </div>
  );
}
