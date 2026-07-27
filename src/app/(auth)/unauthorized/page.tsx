"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/use-auth";
import { SubmitButton } from "@/components/auth/SubmitButton";

/**
 * Bare card content only — the (auth) layout already provides the velvet
 * backdrop and the white card. This page used to paint its own
 * `min-h-screen` panel with app-shell theme tokens (`--claude-dark`,
 * `--theme-bg-*`) inside that card, which stretched the card to viewport
 * height and flipped light/dark with the app theme while the auth shell
 * stayed fixed — the same double-wrap bug class as the internal-console
 * callback page.
 */
export default function UnauthorizedPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleGoBack = () => {
    if (user) {
      router.push("/");
    } else {
      router.push("/login");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <>
      <div
        className="unauthorized-card-header mb-6"
        data-testid="unauthorized-page"
      >
        <h1
          className="unauthorized-card-title text-ctx-primary text-[26px] font-bold"
          data-testid="unauthorized-title"
        >
          Access Denied
        </h1>
        <p className="unauthorized-card-body text-ctx-body text-[15px] mt-2 opacity-80">
          You don&apos;t have permission to access this page.
        </p>
      </div>

      {user && (
        <div className="unauthorized-signed-in-as bg-ctx-soft rounded-xl py-3.5 px-4 mb-6">
          <p className="text-ctx-body text-[14px]">
            Signed in as:{" "}
            <span className="text-ctx-primary font-semibold">
              {user.full_name || user.email}
            </span>
          </p>
          {user.role && (
            <p className="text-ctx-muted text-[13px] mt-1">Role: {user.role}</p>
          )}
        </div>
      )}

      <div className="unauthorized-actions space-y-3">
        <SubmitButton
          type="button"
          isPending={false}
          label="Go Back"
          pendingLabel="Go Back"
          onClick={handleGoBack}
          data-testid="unauthorized-go-back"
        />
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="unauthorized-sign-out w-full py-2 text-center text-ctx-purple text-[14px] font-semibold cursor-pointer"
          data-testid="unauthorized-sign-out"
        >
          Sign Out
        </button>
      </div>
    </>
  );
}
