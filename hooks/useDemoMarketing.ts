"use client";

import { useState, useEffect, useCallback } from "react";
import type { MarketingDashboardPayload } from "@/app/api/v1/admin/demos/marketing/route";

export function useDemoMarketing() {
  const [data, setData] = useState<MarketingDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/demos/marketing");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch marketing data");
      }
      setData(json.data as MarketingDashboardPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading marketing analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/admin/demos/marketing");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to fetch marketing data");
        }
        setData(json.data as MarketingDashboardPayload);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading marketing analytics");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error, refetch: fetchMarketing };
}
