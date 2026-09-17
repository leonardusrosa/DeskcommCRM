"use client";

import { useState, useEffect, useCallback } from "react";
import type { DemoCatalogProfile } from "@/scripts/demo/lib/demo-catalog";

export function useDemoCatalog() {
  const [profiles, setProfiles] = useState<DemoCatalogProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/catalog");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load demo catalog");
      }
      setProfiles(json.data.profiles as DemoCatalogProfile[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/demo/catalog");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to load demo catalog");
        }
        setProfiles(json.data.profiles as DemoCatalogProfile[]);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error loading profiles");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const filteredProfiles = selectedCategory === "all"
    ? profiles
    : profiles.filter((p) => p.category === selectedCategory);

  const categories = Array.from(new Set(profiles.map((p) => p.category)));

  return {
    profiles: filteredProfiles,
    categories,
    selectedCategory,
    setSelectedCategory,
    loading,
    error,
    refetch: fetchProfiles,
  };
}
