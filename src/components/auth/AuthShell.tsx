"use client";

import { BrandLogo } from "./BrandLogo";

/**
 * Portable auth page shell — velvet backdrop, brand logo, centered white
 * card, footer slot. Part of the brand-context kit (`components/auth/` +
 * `styles/brand-context.css`): route groups render this from their
 * layout.tsx so the shell (backdrop, card width, spacing) travels with
 * the kit when copied to another repo instead of living in per-repo
 * layout markup that drifts.
 *
 * The repo-specific bits (footer links, post-login destinations) stay in
 * the consuming layout/pages — that's the "spin"; this shell is the base.
 */
export function AuthShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="auth-page velvet-dark min-h-dvh flex flex-col relative overflow-x-clip">
      {/* Logo */}
      <div className="auth-page-logo shrink-0 z-20 px-4">
        <div className="max-w-[1300px] mx-auto">
          <div className="h-14 md:h-16 flex items-center">
            <BrandLogo />
          </div>
        </div>
      </div>

      {/* Card wrapper */}
      <div className="card-light-wrapper relative z-10 flex-1 flex items-start md:items-center justify-center w-full px-3 sm:px-4 py-4 sm:py-8">
        <div className="card-light relative max-w-[520px] w-full overflow-y-auto bg-white text-gray-900 rounded-2xl shadow-[0_20px_60px_rgba(10,37,64,0.1)] px-4 sm:px-8 pt-6 sm:pt-7 pb-5 sm:pb-6">
          {children}
        </div>
      </div>

      {/* Footer */}
      <div className="auth-footer shrink-0 z-10 px-8 py-4 flex items-center justify-end">
        {footer}
      </div>
    </div>
  );
}
