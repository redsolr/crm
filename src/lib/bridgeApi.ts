/**
 * Jurisimus-bridge status client (Account → Integrations card).
 *
 * Hits `/api/bridge` — read-only: is the platform's bridge token
 * configured here, and what has the bridge written lately. The events
 * themselves arrive through the /mcp door, never through this client.
 */

import { BaseApiClient } from "./api-client";
import type { WireActivity } from "@/server/activities";

export interface BridgeStatus {
  configured: boolean;
  events: WireActivity[];
}

class BridgeApiClient extends BaseApiClient {
  async getStatus(): Promise<BridgeStatus> {
    return this.request<BridgeStatus>("/bridge", { method: "GET" });
  }
}

export const bridgeApi = new BridgeApiClient();
