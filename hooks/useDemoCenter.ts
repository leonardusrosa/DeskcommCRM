"use client";

import { useState, useEffect, useCallback } from "react";
import type { RevenueForecastReport } from "@/scripts/demo/lib/demo-forecast";
import type { DemoAction } from "@/scripts/demo/lib/demo-actions";
import type { SLATimerRecord } from "@/scripts/demo/lib/demo-sla";
import type { DemoAlertRecord } from "@/scripts/demo/lib/demo-alerts";

export interface DemoCenterData {
  activeDemos: Array<{
    tenantId: string;
    name: string;
    company: string;
    country: string;
    vertical: string;
    ownerEmail: string;
    status: string;
    score: number;
    healthScore: number;
    riskLevel: string;
    createdAt: string;
    expiresAt: string;
  }>;
  highIntent: DemoCenterData["activeDemos"];
  slaIssues: SLATimerRecord[];
  recommendedActions: DemoAction[];
  recentAlerts: DemoAlertRecord[];
  forecast: RevenueForecastReport;
  summary: {
    activeDemosCount: number;
    highIntentCount: number;
    slaIssuesCount: number;
    pendingActionsCount: number;
    alertsCount: number;
    wonMRR: Record<string, number>;
    forecastARR: Record<string, number>;
  };
}

export function useDemoCenter() {
  const [data, setData] = useState<DemoCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCenter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/demo-center");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch command center");
      }
      setData(json.data as DemoCenterData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading command center");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/admin/demo-center");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to fetch command center");
        }
        setData(json.data as DemoCenterData);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading command center");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error, refetch: fetchCenter };
}
