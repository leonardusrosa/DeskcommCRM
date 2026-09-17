"use client";

import { useState, useEffect, useCallback } from "react";
import type { DemoCohortsReport, CohortDimension } from "@/scripts/demo/lib/demo-cohorts";

export function useDemoCohorts() {
  const [dimension, setDimension] = useState<CohortDimension>("country");
  const [data, setData] = useState<DemoCohortsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCohorts = useCallback(async (dim: CohortDimension) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/demos/cohorts?dimension=${dim}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch cohort data");
      }
      setData(json.data as DemoCohortsReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading cohorts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/v1/admin/demos/cohorts?dimension=${dimension}`);
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to fetch cohort data");
        }
        setData(json.data as DemoCohortsReport);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading cohorts");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [dimension]);

  const handleSetDimension = (dim: CohortDimension) => {
    setDimension(dim);
    void fetchCohorts(dim);
  };

  return {
    dimension,
    setDimension: handleSetDimension,
    data,
    loading,
    error,
    refetch: () => fetchCohorts(dimension),
  };
}
