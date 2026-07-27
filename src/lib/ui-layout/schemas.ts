import { z } from "zod";

/**
 * Mirror of `UiLayoutPreferences` in the platform. Drift between
 * backend schema and this Zod schema fails loudly as a `ZodError`
 * on first bad response — the same pattern every other domain uses
 * (`src/lib/chat/schemas.ts`).
 *
 * **Wire convention:** the backend ships + accepts snake_case keys
 * (`panel_widths`, `chat_panel`, `activity_bar`), per
 * `docs/platform/api-discipline.md` § A3 and `UiLayoutResponseDto` /
 * `updateUiLayoutSchema`. This file validates the snake_case wire and
 * `.transform()`s into the camelCase shape consumers use. (The earlier
 * version declared camelCase keys directly with no transform, so Zod
 * silently stripped the snake_case wire fields and server values never
 * reached the store — cross-device sync was a no-op masked by
 * localStorage. Fixed alongside the activity-bar work.)
 *
 * Versioned with `v: 1`. When the backend bumps the shape, consumers
 * branch on `v` and can ignore legacy fields instead of crashing.
 */
const PANEL_WIDTH = z.number().int().min(120).max(3000).optional();

const PanelWidthsWireSchema = z.object({
  sidebar: PANEL_WIDTH,
  chat_panel: PANEL_WIDTH,
  findings_panel: PANEL_WIDTH,
  member_detail: PANEL_WIDTH,
});

const ActivityBarWireSchema = z.object({
  order: z.array(z.string()).optional(),
  hidden: z.array(z.string()).optional(),
});

/**
 * Internal (camelCase) shape consumers read. Keys are optional — stores
 * build partial panel-width objects (one field per drag), so a required-key
 * shape here would reject them. Annotated on the transform so the inferred
 * type stays optional-keyed.
 */
export interface UiLayoutPreferences {
  v: 1;
  panelWidths?: {
    sidebar?: number;
    chatPanel?: number;
    findingsPanel?: number;
    memberDetail?: number;
  };
  activityBar?: {
    order?: string[];
    hidden?: string[];
  };
  /**
   * Guided-tour ids the user has dismissed or completed (`welcome-v1`,
   * `welcome-v1:completed`, …). Whole-list replace on write — the
   * client reads, appends, sends the full list back.
   */
  dismissedTours?: string[];
}

export const UiLayoutSchema = z
  .object({
    v: z.literal(1),
    panel_widths: PanelWidthsWireSchema.optional(),
    activity_bar: ActivityBarWireSchema.optional(),
    dismissed_tours: z.array(z.string()).optional(),
  })
  .transform(
    (o): UiLayoutPreferences => ({
      v: o.v,
      panelWidths: o.panel_widths
        ? {
            sidebar: o.panel_widths.sidebar,
            chatPanel: o.panel_widths.chat_panel,
            findingsPanel: o.panel_widths.findings_panel,
            memberDetail: o.panel_widths.member_detail,
          }
        : undefined,
      activityBar: o.activity_bar
        ? {
            order: o.activity_bar.order,
            hidden: o.activity_bar.hidden,
          }
        : undefined,
      dismissedTours: o.dismissed_tours,
    }),
  );

/**
 * Response envelope — backend wraps payloads in `{ data: ... }` for
 * consistency with the rest of `UserPreferencesController`.
 */
export const UiLayoutResponseSchema = z
  .object({ data: UiLayoutSchema })
  .transform((r) => r.data);

/**
 * PATCH input — the internal camelCase shape callers pass. The client
 * (`./client.ts`) serializes this to the snake_case wire body; `v` is
 * immutable from the client (the server sets it on write).
 */
export interface UpdateUiLayoutDto {
  panelWidths?: Partial<Record<PanelKey, number>>;
  activityBar?: {
    order?: string[];
    hidden?: string[];
  };
  dismissedTours?: string[];
}

/** Panel keys exposed for persistence. Mirrors the backend union. */
export type PanelKey =
  | "sidebar"
  | "chatPanel"
  | "findingsPanel"
  | "memberDetail";

/** camelCase panel key → snake_case wire key. */
export const PANEL_KEY_TO_WIRE: Record<PanelKey, string> = {
  sidebar: "sidebar",
  chatPanel: "chat_panel",
  findingsPanel: "findings_panel",
  memberDetail: "member_detail",
};
