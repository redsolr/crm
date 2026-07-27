"use client";

import Link from "next/link";

/**
 * Privacy/Terms footer links for auth-shell surfaces — pass as
 * AuthShell's `footer` prop. Part of the auth kit: repos without local
 * /legal routes (e.g. crm-web) pass absolute URLs, which render as
 * new-tab anchors instead of Next links.
 */
export function AuthLegalFooter({
  privacyHref = "/legal/privacy",
  termsHref = "/legal/terms",
}: {
  privacyHref?: string;
  termsHref?: string;
}) {
  const linkClass = "text-ctx-muted text-xs font-semibold transition-colors";
  const links = [
    { label: "Privacy", href: privacyHref },
    { label: "Terms", href: termsHref },
  ];
  return (
    <div className="auth-legal-footer flex items-center gap-5">
      {links.map(({ label, href }) =>
        href.startsWith("http") ? (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {label}
          </a>
        ) : (
          <Link key={label} href={href} className={linkClass}>
            {label}
          </Link>
        ),
      )}
    </div>
  );
}
