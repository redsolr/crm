"use client";

/**
 * `matterGraphApi` — the PLATFORM matter authority graph
 * (`GET /v1/legal/matters/:id/graph`), authenticated via `BaseApiClient`. The
 * matter graph is the law sections + Supreme Court rulings this matter's
 * findings touch, wired by the corpus citation graph.
 *
 * The wire shape is identical to the org knowledge-graph view (serialized
 * graphology graph + community legend + stats), so we reuse
 * `GraphViewResponseSchema` and the Sigma.js `GraphCanvas` unchanged.
 *
 * Platform module: `platform/src/modules/legal/legal-matter-graph.*`.
 */
import { BaseApiClient } from "../api-client";
import { parseApiResponse } from "../chat/schemas";
import {
  GraphViewResponseSchema,
  type GraphViewResponse,
} from "../knowledge-graph/schemas";

class MatterGraphApiClient extends BaseApiClient {
  /** The matter's authority graph. `matterId` is the prefixed work_item id
   *  (`wi_…`). Workspace context rides the auth principal / header. */
  async getGraph(matterId: string): Promise<GraphViewResponse> {
    const endpoint = `/legal/matters/${encodeURIComponent(matterId)}/graph`;
    const raw = await this.request<unknown>(endpoint, { method: "GET" });
    return parseApiResponse(GraphViewResponseSchema, endpoint, raw);
  }
}

export const matterGraphApi = new MatterGraphApiClient();
