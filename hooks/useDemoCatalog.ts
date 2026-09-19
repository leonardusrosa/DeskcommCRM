"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DentalDemoCatalogCard } from "@/lib/demo/catalog";

export function useDemoCatalog() {
  const [profiles, setProfiles] = useState<DentalDemoCatalogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provisioningEnabled, setProvisioningEnabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/catalog", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to load demos.");
      setProfiles(json.data.profiles as DentalDemoCatalogCard[]);
      setProvisioningEnabled(Boolean(json.data.provisioningEnabled));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load demos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const countries = useMemo(() => profiles.map((profile) => profile.country), [profiles]);
  return { profiles, countries, provisioningEnabled, loading, error, reload: load };
}
