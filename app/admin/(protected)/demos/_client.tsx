"use client";

import { useState } from "react";
import { useAdminDemos } from "@/hooks/useAdminDemos";
import { DemosFilters } from "@/components/admin/demos/DemosFilters";
import { DemosTable } from "@/components/admin/demos/DemosTable";
import type { AdminDemosFilters } from "@/types/demo-admin";

export function AdminDemosClient() {
  const [filters, setFilters] = useState<AdminDemosFilters>({});
  const { demos, isLoading, updateStatus } = useAdminDemos(filters);

  const total = demos.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Demos Comerciales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading
              ? "Cargando demostraciones..."
              : `${total} demo${total !== 1 ? "s" : ""} registrada${total !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <DemosFilters filters={filters} onChange={setFilters} />

      {/* Scored Demos Table */}
      <DemosTable
        data={demos}
        isLoading={isLoading}
        onUpdateStatus={async (tenantId, status) => {
          await updateStatus({ tenantId, status });
        }}
      />
    </div>
  );
}
