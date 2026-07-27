/**
 * Chat-specific Playwright fixture.
 * Extends the auth fixture with chat route setup helpers.
 */

import { test as authedTest, expect } from "./auth.fixture";
import { Page } from "@playwright/test";
import {
  setupChatHandlers,
  setupChatStreamError,
  setupChatStreamHttpError,
  setupSlowChatStream,
  type ChatHandlerOptions,
} from "../handlers/chat.handlers";
import {
  setupUsageLimitExceeded,
  setupUsageHandlers,
} from "../handlers/usage.handlers";

interface UsageWarningOptions {
  usage_percentage?: number;
  warning_message?: string;
}

export const test = authedTest.extend<{
  chatPage: Page;
  setupChat: (options?: ChatHandlerOptions) => Promise<{ chatId: string }>;
  setupStreamError: (msg?: string) => Promise<void>;
  setupStreamHttpError: (status: number) => Promise<void>;
  setupSlowStream: (content: string, delayMs?: number) => Promise<void>;
  setupUsageLimit: () => Promise<void>;
  setupUsageWarning: (options?: UsageWarningOptions) => Promise<void>;
}>({
  chatPage: async ({ authedPage }, use) => {
    await use(authedPage);
  },

  setupChat: async ({ authedPage }, use) => {
    await use(async (options?: ChatHandlerOptions) => {
      return setupChatHandlers(authedPage, options);
    });
  },

  setupStreamError: async ({ authedPage }, use) => {
    await use(async (msg?: string) => {
      await setupChatStreamError(authedPage, msg);
    });
  },

  setupStreamHttpError: async ({ authedPage }, use) => {
    await use(async (status: number) => {
      await setupChatStreamHttpError(authedPage, status);
    });
  },

  setupSlowStream: async ({ authedPage }, use) => {
    await use(async (content: string, delayMs?: number) => {
      await setupSlowChatStream(authedPage, content, delayMs);
    });
  },

  setupUsageLimit: async ({ authedPage }, use) => {
    await use(async () => {
      await setupUsageLimitExceeded(authedPage);
    });
  },

  setupUsageWarning: async ({ authedPage }, use) => {
    await use(async (options?: UsageWarningOptions) => {
      await setupUsageHandlers(authedPage, {
        allowed: true,
        usage_percentage: options?.usage_percentage ?? 92,
        warning_message:
          options?.warning_message ?? "You've used 92% of your monthly limit.",
      });
    });
  },
});

export { expect };
