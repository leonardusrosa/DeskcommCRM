"use client";

import { useState, useEffect, useCallback } from "react";
import type { IntegrationItem, IntegrationCategory } from "@/scripts/demo/integrations/marketplace";

export function useDemoIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<IntegrationCategory | "all">("all");

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = activeTab === "all"
        ? "/api/v1/admin/demo-center/integrations"
        : `/api/v1/admin/demo-center/integrations?category=${activeTab}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load integrations");
      }
      setIntegrations(json.data.integrations as IntegrationItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading integrations");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const url = activeTab === "all"
          ? "/api/v1/admin/demo-center/integrations"
          : `/api/v1/admin/demo-center/integrations?category=${activeTab}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to load integrations");
        }
        setIntegrations(json.data.integrations as IntegrationItem[]);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading integrations");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [activeTab]);

  return {
    integrations,
    loading,
    error,
    activeTab,
    setActiveTab,
    refetch: fetchIntegrations,
  };
}
