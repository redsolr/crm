/**
 * Route-level loading boundary for /work — same instant-commit
 * doctrine as the /sales boundary (see sales/loading.tsx).
 */

import { CrmViewSkeleton } from "@/components/sales/crm/CrmViewSkeleton";

export default function WorkRouteLoading() {
  return <CrmViewSkeleton title="Work" testId="work-route-loading" />;
}
