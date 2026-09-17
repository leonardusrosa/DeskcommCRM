"use client";

import { useState, useEffect, useCallback } from "react";
import type { SalesPerformancePayload } from "@/app/api/v1/admin/sales/performance/route";

export function useSalesPerformance() {
  const [data, setData] = useState<SalesPerformancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/sales/performance");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch sales performance data");
      }
      setData(json.data as SalesPerformancePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading sales performance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/admin/sales/performance");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to fetch sales performance data");
        }
        setData(json.data as SalesPerformancePayload);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading sales performance");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error, refetch: fetchPerformance };
}
