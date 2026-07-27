"use client";

import { BrandLogo } from "./BrandLogo";

/**
 * Shared brand header used across auth pages.
 * Mobile: fixed-height bar with left-aligned logo.
 * Desktop: absolute-positioned logo top-left.
 */
export function BrandHeader() {
  return (
    <>
      {/* Mobile */}
      <div className="brand-header-mobile md:hidden absolute top-0 left-0 right-0 z-20 h-14 flex items-center px-5 bg-white/80 backdrop-blur-sm border-b border-ctx-line">
        <BrandLogo />
      </div>

      {/* Desktop */}
      <div className="brand-header-desktop hidden md:block absolute top-0 left-0 right-0 z-20 px-8 py-6 pointer-events-none">
        <BrandLogo className="pointer-events-auto" />
      </div>
    </>
  );
}

/** Standard mobile header height for layout spacing. */
export const BRAND_HEADER_HEIGHT = 56;
