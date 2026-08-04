"use client";

/**
 * Account page — crm-web's own design (2026-07-14).
 *
 * Originally a verbatim copy of web-app's account page; redesigned in
 * the CRM shell's visual language (crm-view-header, crm-panel,
 * crm-stat-tile, crm-row-card-inset — same tokens as the Reports and
 * detail views) after the copy read as unfinished here: full-bleed
 * centered stats, an empty Subscription box, a dead Export button.
 *
 * Honest empty states instead of blank panels: a no-subscription org
 * says so. The Sign Out button keeps its accessible name — the
 * logout-flows integration spec drives it.
 */

import { formatCurrency, formatSeatPrice } from "@/lib/format-currency";
import { LoadingDots } from "@/components/shared/LoadingDots";
import { ThemeCard } from "@/components/shared/ThemeCard";
import { InvitesSection } from "@/components/account/InvitesSection";
import { useAuth } from "@/stores/use-auth";
import { useTheme, type ThemeMode } from "@/stores/use-theme";
import { useUserSettings } from "@/stores/use-user-settings";
import { getInitials, colorFromSeed, BRAND_AVATAR_COLORS } from "@/lib/avatar";

export default function AccountPage() {
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const { usage, subscription, hydrated } = useUserSettings();
  const isLoading = !hydrated;

  const getPlanDisplayName = (planType: string) => {
    switch (planType) {
      case "free":
        return "Free Plan";
      case "team":
        return "Team Plan";
      default:
        return "Unknown Plan";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="crm-account-view flex-1 min-w-0 flex items-center justify-center">
        <LoadingDots label="Loading account" />
      </div>
    );
  }

  const name = user?.full_name || user?.email || "You";
  const roles = user?.roles?.length
    ? user.roles
    : user?.role
      ? [user.role]
      : [];

  return (
    <div className="crm-account-view flex-1 min-w-0 overflow-y-auto">
      <div className="crm-view-header">
        <h1 className="crm-view-title">Account</h1>
      </div>

      <div className="crm-account-body crm-screen-center mx-auto px-5 py-5 max-w-3xl space-y-4">
        {/* ── Identity ── */}
        <section className="crm-panel space-y-4" data-testid="account-profile">
          <div className="flex items-center gap-3">
            <div
              className="account-avatar flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{
                backgroundColor: colorFromSeed(name, BRAND_AVATAR_COLORS),
              }}
              aria-hidden
            >
              {getInitials(name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-semibold text-[var(--theme-text-primary)]">
                  {name}
                </p>
                {roles.map((role) => (
                  <span
                    key={role}
                    className="account-role-badge rounded-full border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] px-2 py-0.5 text-[11px] font-medium text-[var(--theme-text-secondary)]"
                  >
                    {role}
                  </span>
                ))}
              </div>
              <p className="truncate text-[13px] text-[var(--theme-text-secondary)]">
                {user?.email || "No email"}
              </p>
            </div>
          </div>
          <div className="border-t border-[var(--theme-border-primary)] pt-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-text-muted)] mb-1">
              Account ID
            </span>
            <span className="font-mono text-[12.5px] text-[var(--theme-text-secondary)]">
              {user?.account_id}
            </span>
          </div>
        </section>

        {/* ── Appearance — same light/auto/dark picker as web-app's
               Settings → Appearance; writes through the shared theme
               store, so it applies instantly and persists. ── */}
        <section className="crm-panel space-y-3" data-testid="account-appearance">
          <h2 className="crm-panel-title">Appearance</h2>
          <div className="flex gap-3 md:gap-4">
            {(["light", "system", "dark"] as ThemeMode[]).map((m) => (
              <ThemeCard
                key={m}
                mode={m}
                active={mode === m}
                onClick={() => setMode(m)}
              />
            ))}
          </div>
        </section>

        {/* ── Team — owned invite flow (2026-08-03) ── */}
        <InvitesSection />

        {/* ── Subscription ── */}
        <section
          className="crm-panel space-y-3"
          data-testid="account-subscription"
        >
          <h2 className="crm-panel-title">Subscription</h2>
          {subscription ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[var(--theme-text-primary)]">
                  {getPlanDisplayName(subscription.plan_type)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    subscription.status === "active"
                      ? "bg-[var(--crm-green-subtle)] text-[var(--crm-green)]"
                      : "bg-[var(--crm-red-subtle)] text-[var(--crm-red)]"
                  }`}
                >
                  {subscription.status}
                </span>
              </div>
              <p className="text-[13px] text-[var(--theme-text-secondary)]">
                {/* Plan-currency money (THB today) — usage numbers
                    below stay USD-metered. */}
                {formatSeatPrice(
                  subscription.price_cents,
                  subscription.currency,
                )}{" "}
                / {subscription.billing_interval === "year" ? "year" : "month"}
                {subscription.seat_count
                  ? ` · ${subscription.seat_count} ${subscription.seat_count === 1 ? "seat" : "seats"}`
                  : ""}
              </p>
              <p className="text-[12.5px] text-[var(--theme-text-muted)]">
                Billing period {formatDate(subscription.current_period_start)}{" "}
                – {formatDate(subscription.current_period_end)}
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--theme-text-muted)]">
              No subscription on this organization.
            </p>
          )}
        </section>

        {/* ── Usage — consolidated across every org the caller's
               account owns; per-org breakdown supports chargeback for
               multi-org payers. ── */}
        <section className="crm-panel space-y-3" data-testid="account-usage">
          <h2 className="crm-panel-title">Usage this billing period</h2>
          {usage ? (
            <>
              <div className="crm-stat-row">
                <div className="crm-stat-tile">
                  <div className="crm-stat-label">Tokens used</div>
                  <div className="crm-stat-value">
                    {usage.consolidated.token_count.toLocaleString()}
                  </div>
                  <div className="crm-stat-sub">
                    Across {usage.organizations_count} organization
                    {usage.organizations_count === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="crm-stat-tile">
                  <div className="crm-stat-label">Total cost</div>
                  <div className="crm-stat-value">
                    {formatCurrency(usage.consolidated.total_cost_cents)}
                  </div>
                  <div className="crm-stat-sub">This billing period</div>
                </div>
              </div>
              {usage.by_organization.length > 0 && (
                <div className="space-y-2">
                  {usage.by_organization.map((org) => (
                    <div
                      key={org.organization_id}
                      className="crm-row-card crm-row-card-inset"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--theme-text-primary)]">
                        {org.name}
                      </span>
                      <span className="text-[12.5px] text-[var(--theme-text-muted)]">
                        {org.token_count.toLocaleString()} tokens
                      </span>
                      <span className="text-[13px] text-[var(--theme-text-secondary)]">
                        {formatCurrency(org.total_cost_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] text-[var(--theme-text-muted)]">
              No usage recorded yet.
            </p>
          )}
        </section>

        {/* ── Session ── */}
        <div className="flex items-center justify-end pt-1">
          <button
            onClick={logout}
            className="account-sign-out-button rounded-lg border border-[var(--crm-red)]/40 px-4 py-2 text-[13px] font-medium text-[var(--crm-red)] transition-colors hover:bg-[var(--crm-red-subtle)] hover:border-[var(--crm-red)]/60"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
