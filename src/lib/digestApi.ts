import { BaseApiClient } from "./api-client";
import type { DigestPayload } from "./digest";

/** Morning-digest client — read-only; runs are cron/founder-triggered
 *  server-side (`POST /api/digest/run` with the CRON_SECRET bearer). */
class DigestApiClient extends BaseApiClient {
  getLatest() {
    return this.request<{ digest: DigestPayload | null }>("/digest/latest");
  }
}

export const digestApi = new DigestApiClient();
