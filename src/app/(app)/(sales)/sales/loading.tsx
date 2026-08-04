/**
 * Route-level loading boundary for /sales/* — lets the App Router
 * commit navigation instantly (URL + shell paint) while the target
 * segment loads, instead of blocking the click on the payload fetch.
 * The view's own first-load skeleton takes over once it mounts.
 */

import { CrmViewSkeleton } from "@/components/sales/crm/CrmViewSkeleton";

export default function SalesRouteLoading() {
  return <CrmViewSkeleton testId="sales-route-loading" />;
}
