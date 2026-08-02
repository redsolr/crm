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

interface LastAccountCardProps {
  account: LastAccount;
  onContinueWithPassword: () => void;
  onUseAnotherAccount: () => void;
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
  onUseAnotherAccount,
}: LastAccountCardProps) {
  const href = oauthHref(account);
  const body = (
    <>
      <span
        className="last-account-avatar w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-ctx-purple-light text-ctx-purple font-semibold text-[17px]"
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
      <span className="last-account-method flex-shrink-0 text-ctx-muted text-[12px] font-medium">
        {methodLabel(account.method)}
      </span>
    </>
  );

  const cardClass =
    "last-account-card w-full py-3 px-4 bg-white rounded-xl border border-ctx-line flex items-center gap-3 cursor-pointer transition-all hover:shadow-sm";

  return (
    <div className="last-account mb-6" data-testid="login-last-account">
      {href !== null ? (
        <a
          href={href}
          className={cardClass}
          data-testid="login-last-account-continue"
        >
          {body}
        </a>
      ) : (
        <button
          type="button"
          className={cardClass}
          data-testid="login-last-account-continue"
          onClick={onContinueWithPassword}
        >
          {body}
        </button>
      )}
      <button
        type="button"
        className="last-account-switch mt-2 text-ctx-purple text-[13px] font-semibold cursor-pointer"
        data-testid="login-last-account-clear"
        onClick={onUseAnotherAccount}
      >
        Use another account
      </button>
    </div>
  );
}
