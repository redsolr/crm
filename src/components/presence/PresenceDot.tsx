/**
 * Presence indicator dot — green when active, muted when away. Shared so the
 * account menu and team-chat avatars render presence identically (they only
 * differ by the ring color, which matches the surface they sit on).
 */
export function PresenceDot({
  away,
  /** Tailwind border-color class matching the surface (so the ring "cuts out"). */
  ringClassName = "border-[var(--theme-bg-primary)]",
  className = "",
  title,
}: {
  away: boolean;
  ringClassName?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`presence-dot absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${ringClassName} ${
        away ? "bg-[var(--theme-text-muted)]" : "bg-green-500"
      } ${className}`}
      title={title ?? (away ? "Away" : "Active")}
      aria-hidden
    />
  );
}
