"use client";

import { AuthFooterLink } from "@/components/auth/AuthFooterLink";

/**
 * crm-web is the company's internal CRM (ADR-001) — there is no signup
 * at all. This route stays alive so direct hits land on an honest
 * explanation instead of a 404; access is by team invite only.
 */
export default function SignupPage() {
  return (
    <>
      <div className="signup-invitation-only flex flex-col gap-4">
        <h1 className="signup-invitation-title text-2xl font-semibold">
          Internal tool — invite only
        </h1>
        <p className="signup-invitation-body text-[15px] opacity-80">
          This is the company&apos;s internal CRM. If you should have
          access, ask for an invite link.
        </p>
      </div>

      <AuthFooterLink
        text="Already have an account?"
        linkText="Sign in"
        href="/login"
      />
    </>
  );
}
