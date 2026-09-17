"use client";

import { useState, useEffect, useCallback } from "react";
import type { UnifiedTimelineItem } from "@/app/api/v1/admin/demos/[id]/timeline/route";
import type { DemoLead } from "@/scripts/demo/lib/demo-leads";

export interface TimelineData {
  tenantId: string;
  lead?: DemoLead;
  totalEvents: number;
  items: UnifiedTimelineItem[];
}

export function useDemoTimeline(tenantId: string) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const fetchTimeline = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/demos/${tenantId}/timeline`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load timeline");
      }
      setData(json.data as TimelineData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching timeline");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/v1/admin/demos/${tenantId}/timeline`);
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to load timeline");
        }
        setData(json.data as TimelineData);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error fetching timeline");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [tenantId]);

  const filteredItems = data?.items.filter((item) => {
    if (categoryFilter === "all") return true;
    return item.category === categoryFilter;
  }) ?? [];

  return {
    data,
    filteredItems,
    loading,
    error,
    categoryFilter,
    setCategoryFilter,
    refetch: fetchTimeline,
  };
}
