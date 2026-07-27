"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import { AuthLegalFooter } from "@/components/auth/AuthLegalFooter";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthShell
      footer={
        // Legal copy lives on the customer-facing site; this internal app
        // has no /legal routes of its own — absolute URLs render as
        // new-tab anchors.
        <AuthLegalFooter
          privacyHref="https://jurisimus.com/legal/privacy"
          termsHref="https://jurisimus.com/legal/terms"
        />
      }
    >
      {children}
    </AuthShell>
  );
}
