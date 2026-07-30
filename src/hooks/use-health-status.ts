"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/api-base";

type ServiceStatus = "operational" | "degraded" | "down" | "not_configured";
type OverallStatus = "operational" | "degraded" | "outage";

export type { ServiceStatus, OverallStatus };

export interface HealthStatus {
  status: OverallStatus;
  message: string | null;
  services: {
    database: { status: ServiceStatus };
    redis: { status: ServiceStatus };
    ai: { status: ServiceStatus };
  };
}

export const OVERALL_CONFIG: Record<
  OverallStatus,
  { color: string; label: string }
> = {
  operational: { color: "bg-green-500", label: "Healthy" },
  degraded: { color: "bg-yellow-500", label: "Degraded" },
  outage: { color: "bg-red-500", label: "Outage" },
};

export const SERVICE_CONFIG: Record<
  ServiceStatus,
  { color: string; label: string }
> = {
  operational: { color: "bg-green-500", label: "Operational" },
  degraded: { color: "bg-yellow-500", label: "Degraded" },
  down: { color: "bg-red-500", label: "Down" },
  not_configured: { color: "bg-gray-500", label: "Not configured" },
};

export function useHealthStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!navigator.onLine) {
        setOffline(true);
        return;
      }
      try {
        // `/health/*` is mounted OUTSIDE the platform's `/api/` prefix
        // (per platform `setGlobalPrefix` exclude list — same shape as
        // `/auth/*`). The route serves the LB health check and is
        // intentionally version-free; consumer-app online/offline
        // detection rides the same surface.
        const res = await fetch(`${API_BASE}/health/status`, {
          cache: "no-store",
        });
        if (res.ok) {
          setHealth(await res.json());
          setOffline(false);
        } else {
          setOffline(true);
        }
      } catch (err) {
        console.warn("[health] status check failed:", err);
        setOffline(true);
      }
    };

    check();
    const interval = setInterval(check, 30_000);
    const goOnline = () => check();
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (offline) {
    return {
      overall: "outage" as OverallStatus,
      label: "Offline",
      color: "bg-red-500",
      services: null,
      message: "Cannot reach server",
    };
  }

  if (!health) {
    return {
      overall: "operational" as OverallStatus,
      label: "Checking...",
      color: "bg-gray-500",
      services: null,
      message: null,
    };
  }

  const cfg = OVERALL_CONFIG[health.status];
  return {
    overall: health.status,
    label: cfg.label,
    color: cfg.color,
    services: health.services,
    message: health.message,
  };
}
