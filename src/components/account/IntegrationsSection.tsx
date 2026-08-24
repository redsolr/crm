"use client";

import { useQuery } from "@tanstack/react-query";
import { bridgeApi } from "@/lib/bridgeApi";
import { queryKeys } from "@/queries/query-keys";
import { formatRelativeTime } from "@/lib/format-time";

/**
 * Account → Integrations: the CRM side of the app-ecosystem doctrine
 * (every Jurisimus app connects through the /mcp service door). First
 * connection: the Jurisimus platform's crm-bridge — Mission Control
 * demo-request lifecycle mirrored in as companies / deals / notes,
 * written by the "Jurisimus Platform" actor. This card shows the
 * connection posture (is CRM_MCP_BRIDGE_TOKEN set on this deployment)
 * and the bridge's recent timeline writes; rotation happens in env +
 * redeploy, mirrored on the Railway platform service (CRM_MCP_TOKEN).
 */
export function IntegrationsSection() {
  const status = useQuery({
    queryKey: queryKeys.bridge.all,
    queryFn: () => bridgeApi.getStatus(),
  });

  const data = status.data;

  return (
    <section
      className="integrations-section crm-panel space-y-3"
      data-testid="account-integrations"
    >
      <h2 className="crm-panel-title">Integrations</h2>

      <div className="integrations-jurisimus crm-row-card-inset space-y-2">
        <div className="integrations-jurisimus-head flex items-center justify-between">
          <div>
            <div className="integrations-jurisimus-name font-semibold text-[var(--theme-text-primary)]">
              Jurisimus Platform
            </div>
            <div className="integrations-jurisimus-desc text-[13px] text-[var(--theme-text-secondary)]">
              Demo requests from jurisimus.com arrive as companies, deals and
              call notes — written by the &quot;Jurisimus Platform&quot; actor.
            </div>
          </div>
          {status.isLoading ? (
            <span className="integrations-jurisimus-badge text-[12px] text-[var(--theme-text-secondary)]">
              …
            </span>
          ) : (
            <span
              className={`integrations-jurisimus-badge is-${data?.configured ? "connected" : "disconnected"} rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                data?.configured
                  ? "bg-[var(--crm-green-subtle)] text-[var(--crm-green)]"
                  : "bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)]"
              }`}
            >
              {data?.configured ? "Connected" : "Not connected"}
            </span>
          )}
        </div>

        {data && !data.configured && (
          <p className="integrations-jurisimus-hint text-[13px] text-[var(--theme-text-secondary)]">
            Set CRM_MCP_BRIDGE_TOKEN on this deployment (and the same value as
            CRM_MCP_TOKEN on the platform&apos;s Railway service) to connect.
          </p>
        )}

        {data && data.configured && (
          <div className="integrations-jurisimus-events space-y-1">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--theme-text-secondary)]">
              Recent bridge activity
            </div>
            {data.events.length === 0 ? (
              <p className="text-[13px] text-[var(--theme-text-secondary)]">
                Nothing yet — the first landing-page demo request will appear
                here.
              </p>
            ) : (
              <ul className="space-y-1">
                {data.events.slice(0, 8).map((event) => (
                  <li
                    key={event.id}
                    className="integrations-jurisimus-event flex items-baseline justify-between gap-3 text-[13px]"
                  >
                    <span className="truncate text-[var(--theme-text-primary)]">
                      {event.type.replace(/_/g, " ")}
                      {event.entity_identifier
                        ? ` — ${event.entity_identifier}`
                        : ""}
                    </span>
                    <span className="shrink-0 text-[var(--theme-text-secondary)]">
                      {formatRelativeTime(event.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
