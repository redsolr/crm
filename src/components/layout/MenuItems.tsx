"use client";

/**
 * Account-menu items — crm-web's minimal take on web-app's MenuItems.
 *
 * Deliberately just three things (user decision 2026-07-14): the
 * avatar header, "Account settings", and "Log out". The presence
 * status editor, away toggle, and notification-snooze flyout that
 * web-app carries were ported first and then CUT — an internal
 * one-desk CRM has no audience for online/away status. web-app's
 * overlay surfaces (Preferences, Help, What's new, Plans) were never
 * ported; their crm-web equivalent is the single /account page.
 */

import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/use-auth";
import { getInitials, colorFromSeed, BRAND_AVATAR_COLORS } from "@/lib/avatar";
import {
  MenuItem,
  MenuSeparator,
  MenuIconSettings,
  MenuIconLogout,
} from "./menu-primitives";

export function MenuItems({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const name = user?.full_name || user?.email || "You";

  const handleAccountSettings = () => {
    router.push("/account");
    onClose();
  };
  const handleLogout = async () => {
    onClose();
    await logout();
  };

  return (
    <>
      {/* ── Header: avatar + name + email (→ account settings) ── */}
      <button
        type="button"
        onClick={handleAccountSettings}
        className="account-menu-header flex w-full items-center gap-2.5 px-4 pt-2.5 pb-2 text-left transition-colors hover:bg-[var(--theme-bg-hover)]"
        data-testid="account-menu-header"
      >
        <div
          className="account-menu-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: colorFromSeed(name, BRAND_AVATAR_COLORS) }}
          aria-hidden
        >
          {getInitials(name)}
        </div>
        <div className="min-w-0">
          <p className="account-menu-name truncate text-sm font-semibold text-[var(--theme-text-primary)]">
            {name}
          </p>
          <p className="account-menu-email truncate text-xs text-[var(--theme-text-muted)]">
            {user?.email ?? ""}
          </p>
        </div>
      </button>

      <MenuSeparator />

      <MenuItem
        icon={<MenuIconSettings />}
        label="Account settings"
        onClick={handleAccountSettings}
      />
      <MenuSeparator />
      <MenuItem
        icon={<MenuIconLogout />}
        label="Log out"
        onClick={handleLogout}
      />
    </>
  );
}
