"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { CommercialFeatures } from "@/lib/crm/commercial-features";

export function useCommercialFeatures() {
  return useQuery({
    queryKey: ["commercial-features"],
    queryFn: () =>
      apiClient.get<{ data: CommercialFeatures }>("/api/v1/settings/commercial-features"),
    staleTime: 5 * 60 * 1_000,
  });
}
