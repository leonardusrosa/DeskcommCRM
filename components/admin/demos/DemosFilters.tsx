"use client";

import { Input } from "@/components/ui/input";
import { MagnifyingGlass } from "@/lib/ui/icons";
import type { AdminDemosFilters } from "@/types/demo-admin";
import type { DemoLeadStatus } from "@/scripts/demo/lib/demo-leads";

interface DemosFiltersProps {
  filters: AdminDemosFilters;
  onChange: (filters: AdminDemosFilters) => void;
}

const COUNTRIES = [
  { value: "", label: "Todos los países" },
  { value: "CO", label: "🇨🇴 Colombia" },
  { value: "MX", label: "🇲🇽 México" },
  { value: "ES", label: "🇪🇸 España" },
  { value: "PT", label: "🇵🇹 Portugal" },
];

const STATUSES: Array<{ value: DemoLeadStatus | ""; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "requested", label: "Solicitada" },
  { value: "demo_created", label: "Creada" },
  { value: "activated", label: "Activada" },
  { value: "engaged", label: "Engaged" },
  { value: "meeting_booked", label: "Reunión Agendada" },
  { value: "proposal_sent", label: "Propuesta Enviada" },
  { value: "converted", label: "Convertida" },
  { value: "lost", label: "Perdida" },
];

export function DemosFilters({ filters, onChange }: DemosFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 max-w-sm">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Buscar clínica, lead o correo..."
          value={filters.q || ""}
          onChange={(e) => onChange({ ...filters, q: e.target.value || undefined })}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={filters.country || ""}
          onChange={(e) => onChange({ ...filters, country: e.target.value || undefined })}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {COUNTRIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={filters.status || ""}
          onChange={(e) =>
            onChange({
              ...filters,
              status: (e.target.value as DemoLeadStatus) || undefined,
            })
          }
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
