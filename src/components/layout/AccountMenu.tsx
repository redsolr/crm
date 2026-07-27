"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLayoutUI } from "@/stores/use-layout-ui";
import { useClickOutside } from "@/hooks/use-click-outside";
import { MenuItems } from "./MenuItems";

/**
 * Account menu — crm-web adaptation of web-app's AccountMenu.
 *
 * Same portal-to-body pattern (the menu and its notification flyout
 * must escape the sidebar's stacking context), different anchoring:
 * web-app's menu sits flush-right of the activity-bar rail; here it
 * opens ABOVE the sidebar footer that triggers it. The zero-size
 * marker's parent (the footer button) is the anchor, and positioning
 * is imperative (starts hidden, placed on mount + resize) so the first
 * paint never flashes at an unpositioned spot.
 */
const AccountMenu: React.FC = () => {
  const { isAccountMenuOpen, closeAccountMenu } = useLayoutUI();
  const menuRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  useClickOutside(menuRef, closeAccountMenu, isAccountMenuOpen);

  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const position = () => {
      const el = menuRef.current;
      const slot = anchorRef.current?.parentElement;
      if (!el || !slot) return;
      const rect = slot.getBoundingClientRect();
      el.style.left = `${rect.left + 6}px`;
      el.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      el.style.visibility = "visible";
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [isAccountMenuOpen]);

  return (
    <>
      <span ref={anchorRef} className="account-menu-anchor" aria-hidden />
      {isAccountMenuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="account-menu fixed z-[99999] w-72 rounded-lg shadow-xl border py-1.5"
            data-testid="account-menu"
            style={{
              visibility: "hidden",
              backgroundColor: "var(--theme-bg-tertiary)",
              borderColor: "var(--theme-border-secondary)",
            }}
          >
            <MenuItems onClose={closeAccountMenu} />
          </div>,
          document.body,
        )}
    </>
  );
};

export default AccountMenu;
