"use client";

import { useParams } from "next/navigation";
import { SalesOpportunityDetailView } from "@/components/sales/SalesOpportunityDetailView";

export default function SalesOpportunityPage() {
  const params = useParams<{ id: string }>();
  return <SalesOpportunityDetailView opportunityId={params.id} />;
}
