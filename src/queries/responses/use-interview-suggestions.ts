"use client";

import { useMutation } from "@tanstack/react-query";
import { responsesApiClient } from "@/lib/responsesApi";
import { ApiError } from "@/lib/api-client";
import {
  buildSuggestionPrompt,
  parseSuggestions,
  type SuggestionContext,
} from "@/lib/interview/transcript";

/**
 * Live follow-up suggestions for interview mode.
 *
 * Modeled as a mutation, NOT a query, for the same reason as the
 * founder brief: every call is a paid LLM spend on the platform side
 * (`POST /v1/responses { ask: "text" }`). Suggestions fire only on an
 * explicit "Suggest" tap — never on mount, never on refocus — and the
 * result is moment-specific, so there is no cache to manage.
 */
export function useInterviewSuggestions() {
  return useMutation<string[], ApiError | Error, SuggestionContext>({
    mutationFn: async (context) => {
      const response = await responsesApiClient.askText(
        buildSuggestionPrompt(context),
      );
      return parseSuggestions(response.output.text);
    },
  });
}
