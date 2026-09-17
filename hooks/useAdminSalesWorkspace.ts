"use client";

import { useState, useEffect, useCallback } from "react";
import type { SalesWorkspacePayload } from "@/app/api/v1/admin/sales/route";

export function useAdminSalesWorkspace() {
  const [data, setData] = useState<SalesWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/sales");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch sales workspace");
      }
      setData(json.data as SalesWorkspacePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/admin/sales");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to fetch sales workspace");
        }
        setData(json.data as SalesWorkspacePayload);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading workspace");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const completeItem = async (type: "action" | "followup", id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch("/api/v1/admin/sales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update item");
      }
      // Refetch after completion
      await fetchWorkspace();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setActionLoading(null);
    }
  };

  return {
    data,
    loading,
    error,
    actionLoading,
    completeItem,
    refetch: fetchWorkspace,
  };
}
