"use client";

import { useParams } from "next/navigation";
import { SalesAccountDetailView } from "@/components/sales/SalesAccountDetailView";

export default function SalesAccountPage() {
  const params = useParams<{ id: string }>();
  return <SalesAccountDetailView accountId={params.id} />;
}
