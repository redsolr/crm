import type { ReactNode } from "react";

/** Shared label wrapper for the sales create/transition modals. */
export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

/** Brand-CTA surface (velvet gradient) for the interview flow's
 *  primary actions — launch buttons, selected chips, Next/Finish,
 *  Save. One definition so the brand treatment can't drift between
 *  the seven call sites; compose sizing/shape per site. The gradient
 *  var is re-declared in `.crm-app` scope (globals.css) — see the
 *  2026-07-19 out-of-scope-var incident note there. */
export const BRAND_CTA_CLASS =
  "[background:var(--ctx-accent-gradient)] text-white hover:opacity-90 transition-opacity";

/** Shared input/select/textarea class for the sales create/transition modals. */
export const FORM_INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-secondary)] text-sm text-[var(--claude-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-text-muted)]";
