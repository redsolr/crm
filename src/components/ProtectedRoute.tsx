"use client";

import { useAuth } from "@/stores/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingDots } from "@/components/shared/LoadingDots";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: string[];
}

export default function ProtectedRoute({
  children,
  requiredPermissions = [],
  requiredRoles = [],
}: ProtectedRouteProps) {
  const {
    user,
    loading,
    isAuthenticated,
    needsOnboarding,
    hasPermission,
    hasRole,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!loading && isAuthenticated && needsOnboarding) {
      router.push("/onboarding");
      return;
    }

    if (!loading && user) {
      // For new backend API users (no permissions/roles arrays), allow access if they have account_id
      // This indicates they're properly authenticated with the new system
      if (
        user.account_id &&
        (!user.permissions || user.permissions.length === 0)
      ) {
        // New API user - grant access
        return;
      }

      // Legacy permission checking for old users
      if (requiredPermissions.length > 0 || requiredRoles.length > 0) {
        // Check required permissions
        const hasRequiredPermissions = requiredPermissions.every((permission) =>
          hasPermission(permission),
        );

        // Check required roles
        const hasRequiredRoles = requiredRoles.every((role) => hasRole(role));

        if (!hasRequiredPermissions || !hasRequiredRoles) {
          router.push("/unauthorized");
          return;
        }
      }
    }
  }, [
    user,
    loading,
    isAuthenticated,
    needsOnboarding,
    router,
    requiredPermissions,
    requiredRoles,
    hasPermission,
    hasRole,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--claude-dark)] flex items-center justify-center">
        <LoadingDots label="Checking your session" />
      </div>
    );
  }

  if (!isAuthenticated || needsOnboarding) {
    return null;
  }

  return <FadeIn>{children}</FadeIn>;
}

function FadeIn({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // If splash is currently showing, wait for it to finish
    const splashEl = document.querySelector(".splash-screen");
    if (splashEl) {
      const handler = () => setTimeout(() => setVisible(true), 100);
      window.addEventListener("splash-done", handler, { once: true });
      return () => window.removeEventListener("splash-done", handler);
    }

    // No splash — fade in after components settle
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      {children}
    </div>
  );
}
