/**
 * Route-level loading boundary for /account — same instant-commit
 * doctrine as the /sales boundary (see sales/loading.tsx).
 */

import { CrmViewSkeleton } from "@/components/sales/crm/CrmViewSkeleton";

export default function AccountRouteLoading() {
  return <CrmViewSkeleton title="Settings" testId="account-route-loading" />;
}
