/**
 * hooks/useExecutiveIntelligence.ts
 *
 * Custom hook for Executive Intelligence Dashboard.
 * Isolates state management, background polling, and human approval dispatch.
 */

import { useState, useEffect, useCallback } from "react";
import type { ExecutiveIntelligencePayload } from "@/types/demo-intelligence";

export function useExecutiveIntelligence() {
  const [data, setData] = useState<ExecutiveIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/intelligence");
      if (!res.ok) {
        throw new Error(`Failed to load intelligence metrics (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error.message || "Failed to load intelligence");
      }
      setData(json.data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const res = await fetch("/api/v1/admin/intelligence");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!active) return;
        if (json.data) {
          setData(json.data);
          setError(null);
        }
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  const approveAction = async (actionId: string) => {
    setActionInProgress(actionId);
    try {
      const res = await fetch("/api/v1/admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_agent_action", actionId }),
      });
      if (!res.ok) throw new Error("Approval failed");
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  const rejectAction = async (actionId: string, reason?: string) => {
    setActionInProgress(actionId);
    try {
      const res = await fetch("/api/v1/admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject_agent_action", actionId, reason }),
      });
      if (!res.ok) throw new Error("Rejection failed");
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  const executeAction = async (actionId: string) => {
    setActionInProgress(actionId);
    try {
      const res = await fetch("/api/v1/admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute_agent_action", actionId }),
      });
      if (!res.ok) throw new Error("Execution failed");
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  const optimizeExperiments = async () => {
    try {
      const res = await fetch("/api/v1/admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "optimize_experiments" }),
      });
      if (!res.ok) throw new Error("Experiment optimization failed");
      await fetchData();
    } catch {
      // fail silent
    }
  };

  return {
    data,
    loading,
    error,
    actionInProgress,
    refresh: fetchData,
    approveAction,
    rejectAction,
    executeAction,
    optimizeExperiments,
  };
}
