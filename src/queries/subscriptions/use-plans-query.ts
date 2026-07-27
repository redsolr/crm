"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { subscriptionsApi } from "@/lib/subscriptionsApi";

export function usePlansQuery() {
  return useQuery({
    queryKey: queryKeys.subscriptions.plans(),
    queryFn: () => subscriptionsApi.getPlans(),
  });
}
