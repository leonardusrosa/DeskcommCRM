"use client";

import { useState, useEffect, useCallback } from "react";
import type { ExecutiveRevenueData } from "@/types/demo-revenue";

export function useExecutiveRevenue() {
  const [data, setData] = useState<ExecutiveRevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/revenue");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch revenue analytics");
      }
      setData(json.data as ExecutiveRevenueData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading revenue metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/admin/revenue");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to fetch revenue analytics");
        }
        setData(json.data as ExecutiveRevenueData);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading revenue metrics");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error, refetch: fetchRevenue };
}
