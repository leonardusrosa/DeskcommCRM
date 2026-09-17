"use client";

import { useEffect, useState } from "react";
import type { DemoAnalyticsPayload } from "@/app/api/v1/admin/demos/analytics/route";

export function useDemoAnalytics() {
  const [data, setData] = useState<DemoAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/demos/analytics");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Analytics fetch failed");
      setData(json.data as DemoAnalyticsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetch_(); }, []);

  return { data, loading, error, refetch: fetch_ };
}
