"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { createQueryClient } from "./query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Dev aid only — and NOT in e2e: the floating bubble sits over the
          bottom-right corner and intercepts clicks on composer send buttons. */}
      {process.env.NODE_ENV === "development" &&
        process.env.NEXT_PUBLIC_E2E !== "true" && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
    </QueryClientProvider>
  );
}
