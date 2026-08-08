"use client";

/**
 * The Inbox lives as the Pipeline's first tab since 2026-08-08 (it
 * absorbed the Summary tab and this standalone view). Old bookmarks
 * and the search suggestions still point here — select the Inbox tab
 * and land on /sales.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setPipelineViewMode } from "@/components/sales/pipeline-view-mode";

export default function SalesInboxPage() {
  const router = useRouter();
  useEffect(() => {
    setPipelineViewMode("inbox");
    router.replace("/sales");
  }, [router]);
  return null;
}
