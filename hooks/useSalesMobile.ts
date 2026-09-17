"use client";

import { useState, useEffect, useCallback } from "react";
import type { MobileLeadCard } from "@/app/api/v1/sales/mobile/route";

export function useSalesMobile() {
  const [leads, setLeads] = useState<MobileLeadCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyHighIntent, setOnlyHighIntent] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/sales/mobile");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Error loading sales leads");
      }
      setLeads(json.data.leads as MobileLeadCard[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/sales/mobile");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Error loading sales leads");
        }
        setLeads(json.data.leads as MobileLeadCard[]);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading leads");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const filteredLeads = onlyHighIntent
    ? leads.filter((l) => l.isHighIntent || l.score >= 70)
    : leads;

  return {
    leads: filteredLeads,
    totalCount: leads.length,
    loading,
    error,
    onlyHighIntent,
    setOnlyHighIntent,
    refetch: fetchLeads,
  };
}
