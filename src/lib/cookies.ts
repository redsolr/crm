/**
 * Browser cookie write helper. Lives outside component code so event
 * handlers can persist preferences (locale, landing variant) without
 * mutating globals inside a component body.
 */
export function setPreferenceCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}
