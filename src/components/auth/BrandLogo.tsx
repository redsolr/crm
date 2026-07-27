"use client";

import Link from "next/link";

export function BrandLogo({
  className = "",
  color,
}: {
  className?: string;
  color?: string;
}) {
  return (
    <Link
      href="/"
      className={`brand-logo text-ctx-primary text-[22px] font-extrabold tracking-tight cursor-pointer ${className}`}
      style={color ? { color } : undefined}
    >
      Jurisimus
    </Link>
  );
}
