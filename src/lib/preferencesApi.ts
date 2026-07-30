import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { UserPreferenceId } from "./ids";

// ──── Types ────

export type ResponseLength = "concise" | "balanced" | "detailed";
export type Tone = "casual" | "professional" | "formal";

export interface UserPreferences {
  id: UserPreferenceId;
  userId: string;
  role: string | null;
  interests: string[];
  responseLength: ResponseLength;
  tone: Tone;
  onboardingCompletedAt: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdatePreferencesRequest {
  role?: string;
  interests?: string[];
  responseLength?: ResponseLength;
  tone?: Tone;
}

export interface SessionCount {
  count: number;
}

// ──── API Client ────

class PreferencesApiClient extends BaseApiClient {
  async getPreferences(): Promise<UserPreferences | null> {
    const result = await this.request<{ data: UserPreferences | null }>(
      "/user_preferences/me",
    );
    return result.data;
  }

  async updatePreferences(
    updates: UpdatePreferencesRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<UserPreferences | null> {
    const result = await this.request<{ data: UserPreferences | null }>(
      "/user_preferences/me",
      {
        method: "PUT",
        body: JSON.stringify(updates),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return result.data;
  }

  /**
   * Submit first-run onboarding answers. Wire shape is snake_case per
   * the platform's `submitOnboardingSchema`
   * (`platform/src/modules/user-preferences/user-preferences.dto.ts`):
   * `{ role, interests, response_length, tone }`. Sending camelCase
   * `responseLength` is rejected with 422 `validation_failed`.
   */
  async submitOnboarding(
    data: {
      role: string;
      interests: string[];
      response_length: ResponseLength;
      tone: Tone;
    },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<UserPreferences> {
    const result = await this.request<{ data: UserPreferences }>(
      "/user_preferences/onboarding",
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return result.data;
  }

  /**
   * `/auth/sessions` is mounted OUTSIDE the platform's `/api/` prefix
   * (see platform `setGlobalPrefix` exclude list). Routing through
   * `requestUnprefixed` ensures we hit `${API_BASE}/auth/sessions`,
   * not `${API_BASE}/api/auth/sessions` (which 404s).
   */
  async getSessionCount(): Promise<number> {
    const result = await this.requestUnprefixed<SessionCount>(
      "/auth/sessions",
    );
    return result.count;
  }

  /**
   * Backend route is snake_case `/auth/sessions/revoke_all` per
   * `auth.openapi.ts`. Kebab-case `revoke-all` 404s.
   */
  async revokeAllSessions(
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    await this.requestUnprefixed<{ success: boolean }>(
      "/auth/sessions/revoke_all",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  /**
   * Update the signed-in user's account profile. Backend route is
   * `PUT /api/accounts/{accountId}` with snake-case body
   * (`updateAccountSchema` in `platform/src/modules/accounts/accounts.dto.ts`).
   * The platform identity vocabulary is `account`, not `user`; the
   * `user.user_id` in the FE auth store IS the account id.
   */
  async updateProfile(
    accountId: string,
    updates: { fullName?: string; avatarUrl?: string },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    const body: { full_name?: string; avatar_url?: string } = {};
    if (updates.fullName !== undefined) body.full_name = updates.fullName;
    if (updates.avatarUrl !== undefined) body.avatar_url = updates.avatarUrl;
    await this.request(`/accounts/${accountId}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const preferencesApiClient = new PreferencesApiClient();
