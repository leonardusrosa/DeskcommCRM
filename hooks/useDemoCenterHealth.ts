"use client";

import { useState, useEffect, useCallback } from "react";
import type { ObservabilityPayload } from "@/app/api/v1/admin/demo-center/health/route";

export function useDemoCenterHealth() {
  const [data, setData] = useState<ObservabilityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/demo-center/health");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch observability health");
      }
      setData(json.data as ObservabilityPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading health observability");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/admin/demo-center/health");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to fetch observability health");
        }
        setData(json.data as ObservabilityPayload);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading health observability");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error, refetch: fetchHealth };
}
