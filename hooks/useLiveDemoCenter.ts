"use client";

import { useState, useEffect, useCallback } from "react";
import type { DemoBusEvent } from "@/scripts/demo/events/types";
import type { DemoWorkerState } from "@/workers/demo-worker";
import type { SLATimerRecord } from "@/scripts/demo/lib/demo-sla";
import type { ActivityEvent } from "@/scripts/demo/lib/demo-activity";

export interface LiveDemoCenterData {
  recentEvents: DemoBusEvent[];
  queueStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
    total: number;
  };
  workerState: DemoWorkerState;
  activeDemosCount: number;
  activeAlerts: SLATimerRecord[];
  recentActivities: ActivityEvent[];
  polledAt: string;
}

export function useLiveDemoCenter(pollIntervalMs = 4000) {
  const [data, setData] = useState<LiveDemoCenterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLivePolling, setIsLivePolling] = useState(true);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/demo-center/live");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to poll live command center");
      }
      setData(json.data as LiveDemoCenterData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error polling live data");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/admin/demo-center/live");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to poll live command center");
        }
        setData(json.data as LiveDemoCenterData);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error polling live data");
      }
    };

    void load();

    let intervalId: NodeJS.Timeout | null = null;
    if (isLivePolling) {
      intervalId = setInterval(() => {
        void load();
      }, pollIntervalMs);
    }

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLivePolling, pollIntervalMs]);

  const togglePolling = useCallback(() => {
    setIsLivePolling((prev) => !prev);
  }, []);

  return {
    data,
    loading: data === null && error === null,
    error,
    isLivePolling,
    togglePolling,
    refetch: fetchLive,
  };
}
