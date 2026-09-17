"use client";

import { useState, useEffect, useCallback } from "react";
import type { SLAAnalyticsPayload } from "@/app/api/v1/admin/sales/sla/route";

export function useSLAAnalytics() {
  const [data, setData] = useState<SLAAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/sales/sla");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch SLA analytics");
      }
      setData(json.data as SLAAnalyticsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading SLA metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/admin/sales/sla");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to fetch SLA analytics");
        }
        setData(json.data as SLAAnalyticsPayload);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading SLA metrics");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error, refetch: fetchAnalytics };
}
