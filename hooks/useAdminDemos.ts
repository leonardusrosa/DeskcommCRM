"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { AdminDemoItem, AdminDemosFilters } from "@/types/demo-admin";
import type { DemoLeadStatus } from "@/scripts/demo/lib/demo-leads";

interface DemosApiResponse {
  data: AdminDemoItem[];
}

export function useAdminDemos(filters: AdminDemosFilters = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "demos", filters],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (filters.q) qs.set("q", filters.q);
      if (filters.country) qs.set("country", filters.country);
      if (filters.status) qs.set("status", filters.status);
      const url = `/api/v1/admin/demos${qs.toString() ? `?${qs.toString()}` : ""}`;
      const res = await apiClient.get<DemosApiResponse>(url);
      return res.data;
    },
    staleTime: 15_000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      tenantId,
      status,
    }: {
      tenantId: string;
      status: DemoLeadStatus;
    }) => {
      return apiClient.patch("/api/v1/admin/demos", { tenantId, status });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "demos"] });
    },
  });

  return {
    demos: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    updateStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,
  };
}
