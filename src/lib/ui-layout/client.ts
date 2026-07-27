/**
 * `UiLayoutApiClient` — thin wrapper around the
 * `/user-preferences/ui-layout` endpoints. Mirrors
 * `UserPreferencesController` in the platform.
 *
 * This layer is intentionally dumb — merge semantics live server-side
 * so a disconnected client writing one field at a time doesn't have
 * to know about the other fields. See
 * `platform/src/modules/user-preferences/user-preferences.service.ts#updateUiLayout`.
 */

import { BaseApiClient } from "../api-client";
import { parseApiResponse } from "../chat/schemas";
import { freshIdempotencyKey } from "../idempotency";
import {
  UiLayoutResponseSchema,
  PANEL_KEY_TO_WIRE,
  type PanelKey,
  type UiLayoutPreferences,
  type UpdateUiLayoutDto,
} from "./schemas";

/**
 * Serialize the internal camelCase patch into the snake_case wire body
 * the platform's `updateUiLayoutSchema` expects. Sending camelCase
 * (the old behavior) gets silently stripped server-side, so the PATCH
 * became a no-op — the reason cross-device sync didn't work.
 */
function toWireBody(patch: UpdateUiLayoutDto): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (patch.panelWidths) {
    const widths: Record<string, number> = {};
    for (const [key, value] of Object.entries(patch.panelWidths)) {
      if (value !== undefined) {
        widths[PANEL_KEY_TO_WIRE[key as PanelKey]] = value;
      }
    }
    body.panel_widths = widths;
  }

  if (patch.activityBar) {
    const activityBar: Record<string, unknown> = {};
    if (patch.activityBar.order !== undefined) {
      activityBar.order = patch.activityBar.order;
    }
    if (patch.activityBar.hidden !== undefined) {
      activityBar.hidden = patch.activityBar.hidden;
    }
    body.activity_bar = activityBar;
  }

  if (patch.dismissedTours !== undefined) {
    body.dismissed_tours = patch.dismissedTours;
  }

  return body;
}

class UiLayoutApiClient extends BaseApiClient {
  async get(): Promise<UiLayoutPreferences> {
    const endpoint = "/user_preferences/ui_layout";
    const raw = await this.request<unknown>(endpoint, { method: "GET" });
    return parseApiResponse(UiLayoutResponseSchema, endpoint, raw);
  }

  async patch(
    patch: UpdateUiLayoutDto,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<UiLayoutPreferences> {
    const endpoint = "/user_preferences/ui_layout";
    const raw = await this.request<unknown>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(toWireBody(patch)),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(UiLayoutResponseSchema, endpoint, raw);
  }
}

export const uiLayoutApi = new UiLayoutApiClient();
