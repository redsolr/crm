import { loginErrorMessage } from "@/lib/login-error";

/**
 * Red banner above the sign-in card explaining why an OAuth callback
 * bounced back to /login (`?error=<code>` — see `src/lib/login-error.ts`).
 * Server-rendered; the code arrives via the login page's searchParams.
 */
export function LoginErrorBanner({ code }: { code: string }) {
  return (
    <div
      className="login-error-banner flex items-start gap-2.5 mb-6 rounded-xl py-3 px-4 text-[14px] font-semibold"
      style={{ color: "#e53e3e", backgroundColor: "rgba(229, 62, 62, 0.08)" }}
      data-testid="login-error-banner"
    >
      <svg
        className="w-4 h-4 shrink-0 mt-0.5"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zM8 12a1 1 0 110-2 1 1 0 010 2z" />
      </svg>
      {loginErrorMessage(code)}
    </div>
  );
}
