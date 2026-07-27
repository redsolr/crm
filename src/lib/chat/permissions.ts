/**
 * Chat usage-permission hook and presentation helpers.
 *
 * Split out from the old `chatApi.ts` god module so that:
 *   - The hook doesn't drag the rest of the chat surface into every
 *     component that only needs to check permissions.
 *   - The pure helpers (`getModelFallback`, `formatUsageWarning`) can be
 *     used from contexts that don't want React (e.g. tests).
 */

import * as Sentry from "@sentry/nextjs";
import { chatApiClient } from "./client";
import { chatBreadcrumb } from "./breadcrumbs";
import type { ChatPermission } from "./schemas";

// ============================================================================
// Hook
// ============================================================================

/**
 * React hook that returns a `validatePermission(model)` function bound to
 * the active organization. Resolves to `null` on error and logs + reports
 * to Sentry — callers that see `null` should surface a user-facing error
 * rather than silently abort.
 *
 * CLAUDE.md: never swallow errors silently. A previous version of this
 * function returned `null` on any failure with no log, which caused
 * `sendMessage()` to abort with a vague "Failed to validate usage
 * permissions" error and no way to debug.
 */
export function useChatPermissions(organization_id?: string) {
  const validatePermission = async (
    model: string = "gpt-5.4-nano",
  ): Promise<ChatPermission | null> => {
    if (!organization_id) {
      chatBreadcrumb(
        "validatePermission: aborted (no organization_id)",
        "warning",
      );
      console.warn(
        "[useChatPermissions] No organization_id — cannot validate permission. " +
          "User is probably not fully authenticated yet.",
      );
      return null;
    }

    chatBreadcrumb("validatePermission: start", "info", { model });
    try {
      const result = await chatApiClient.validateChatPermission(
        organization_id,
        model,
      );
      chatBreadcrumb("validatePermission: success", "info", {
        allowed: result.allowed,
        usage_percentage: result.usage_percentage,
      });
      return result;
    } catch (error) {
      chatBreadcrumb("validatePermission: failed", "error", {
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(
        `[useChatPermissions] Failed to validate chat permission for organization ${organization_id}, model ${model}:`,
        error,
      );
      // Also report to Sentry as a captured exception so this surfaces in
      // the issue list, not just in the breadcrumb trail of an unrelated
      // crash.
      Sentry.captureException(error, {
        tags: { area: "chat", step: "validatePermission" },
        extra: { organization_id, model },
      });
      return null;
    }
  };

  return { validatePermission };
}

// ============================================================================
// Pure helpers
// ============================================================================

/**
 * Pick a fallback model when the requested one isn't allowed.
 *
 * Hierarchy: nano → mini → full. Ultimate fallback is nano. This function is
 * pure and React-free so it can be called from anywhere.
 */
export const getModelFallback = (permission: ChatPermission): string => {
  if (permission.allowed) return permission.selected_model;

  const fallbackOrder = ["gpt-5.4-nano", "gpt-5.4-mini", "gpt-5.4"];
  for (const model of fallbackOrder) {
    if (model !== permission.selected_model) {
      return model;
    }
  }
  return "gpt-5.4-nano"; // Ultimate fallback
};

/**
 * Format a user-facing usage warning from a `ChatPermission` response.
 * Returns an empty string when there's nothing to warn about.
 */
export const formatUsageWarning = (permission: ChatPermission): string => {
  if (permission.warning_message) return permission.warning_message;

  if (permission.cooldown_info) {
    const { model_on_cooldown, hours_remaining } = permission.cooldown_info;
    return `${model_on_cooldown} is on cooldown for ${hours_remaining.toFixed(1)} hours. Using ${permission.selected_model} instead.`;
  }

  if (permission.usage_percentage > 90) {
    return `You've used ${permission.usage_percentage}% of your monthly limit. Consider upgrading your plan.`;
  }

  if (permission.fallback_used) {
    return `Using ${permission.selected_model} due to usage limits.`;
  }

  return "";
};
