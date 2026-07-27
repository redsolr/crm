import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
          // 429 — retry up to 3× (rate limited; api-client.request also
          // does its own server-side-budgeted retry, so this is a
          // belt-and-suspenders second pass).
          if (error instanceof ApiError && error.status === 429) {
            return failureCount < 3;
          }
          // Other 4xx — don't retry. 401/403/404/409/422 are all client
          // errors; retrying just burns the budget on the same failure.
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            return false;
          }
          // 5xx — retry once.
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
