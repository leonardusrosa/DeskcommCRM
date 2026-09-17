"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { AdminDemoItem } from "@/types/demo-admin";
import type { DemoLeadStatus } from "@/scripts/demo/lib/demo-leads";

interface DemosTableProps {
  data: AdminDemoItem[];
  isLoading?: boolean;
  onUpdateStatus?: (tenantId: string, status: DemoLeadStatus) => Promise<unknown>;
}

const COUNTRY_FLAGS: Record<string, string> = {
  CO: "🇨🇴",
  MX: "🇲🇽",
  ES: "🇪🇸",
  PT: "🇵🇹",
};

const STATUS_LABELS: Record<
  DemoLeadStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  requested: { label: "Solicitada", variant: "outline" },
  demo_created: { label: "Creada", variant: "secondary" },
  activated: { label: "Activada ✨", variant: "secondary" },
  engaged: { label: "Engaged 💬", variant: "default" },
  meeting_booked: { label: "Reunión Agendada 📅", variant: "default" },
  proposal_sent: { label: "Propuesta Enviada 📄", variant: "default" },
  converted: { label: "Convertida 🏆", variant: "default" },
  lost: { label: "Perdida", variant: "destructive" },
  active: { label: "Activa", variant: "default" },
  qualified: { label: "Calificada", variant: "default" },
};

export function DemosTable({ data, isLoading, onUpdateStatus }: DemosTableProps) {
  if (isLoading) {
    return <DemosTableSkeleton />;
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm font-medium text-foreground">No se encontraron demostraciones activas</p>
        <p className="text-xs text-muted-foreground mt-1">
          Crea una nueva demo o ajusta los filtros de búsqueda.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="py-3 px-4 font-medium">Clínica / Entorno</th>
            <th className="py-3 px-4 font-medium">Prospecto Comercial</th>
            <th className="py-3 px-4 font-medium">País & Vertical</th>
            <th className="py-3 px-4 font-medium text-center">Activación</th>
            <th className="py-3 px-4 font-medium text-center">Score</th>
            <th className="py-3 px-4 font-medium">Próxima Acción & Señales</th>
            <th className="py-3 px-4 font-medium">Último Evento</th>
            <th className="py-3 px-4 font-medium">Expiración</th>
            <th className="py-3 px-4 font-medium text-right">Etapa Conversión</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((item) => {
            const flag = COUNTRY_FLAGS[item.country] || "🌐";
            const scoreColor =
              item.score >= 70
                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                : item.score >= 40
                ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
                : "text-muted-foreground bg-muted border-border";

            return (
              <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                {/* Org */}
                <td className="py-3 px-4">
                  <div className="font-semibold text-foreground">{item.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{item.slug}</div>
                </td>

                {/* Lead */}
                <td className="py-3 px-4">
                  {item.lead ? (
                    <div>
                      <div className="font-medium text-foreground">{item.lead.name}</div>
                      <div className="text-muted-foreground">{item.lead.email}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{item.lead.whatsapp}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">Sin lead asociado</span>
                  )}
                </td>

                {/* Country / Vertical */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>{flag}</span>
                    <span>{item.country}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{item.vertical}</div>
                </td>

                {/* Activation Status */}
                <td className="py-3 px-4 text-center">
                  {item.isActivated ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      ✅ Activada
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                      ⏳ Pendiente
                    </span>
                  )}
                </td>

                {/* Score */}
                <td className="py-3 px-4 text-center">
                  <div
                    className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-bold ${scoreColor}`}
                  >
                    {item.score}
                  </div>
                  {item.isHighIntent && (
                    <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                      🔥 Alta Intención
                    </div>
                  )}
                </td>

                {/* Next Action & Signals */}
                <td className="py-3 px-4 max-w-[240px]">
                  <div className="font-medium text-foreground text-[11px] mb-1">
                    {item.nextAction}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.signals.map((sig, idx) => (
                      <span
                        key={idx}
                        title={sig.details}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground border"
                      >
                        {sig.signal === "demo_high_intent" && "🔥 "}
                        {sig.signal === "demo_inactive" && "💤 "}
                        {sig.signal === "demo_expiring" && "⚠️ "}
                        {sig.label}
                      </span>
                    ))}
                  </div>
                </td>

                {/* Last Event */}
                <td className="py-3 px-4">
                  {item.lastEvent ? (
                    <div>
                      <span className="font-mono text-[11px] text-foreground bg-muted px-1.5 py-0.5 rounded border">
                        {item.lastEvent.name}
                      </span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(item.lastEvent.createdAt).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">—</span>
                  )}
                </td>

                {/* Expiration */}
                <td className="py-3 px-4">
                  <div className="text-muted-foreground text-[11px]">
                    {item.expiresAt ? (
                      new Date(item.expiresAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                      })
                    ) : (
                      "Sin límite"
                    )}
                  </div>
                </td>

                {/* Stage Dropdown */}
                <td className="py-3 px-4 text-right">
                  <select
                    value={item.conversionStatus}
                    onChange={(e) =>
                      onUpdateStatus?.(item.id, e.target.value as DemoLeadStatus)
                    }
                    className="h-8 rounded border border-input bg-background px-2 py-0.5 text-xs font-medium text-foreground shadow-sm"
                  >
                    {(Object.keys(STATUS_LABELS) as DemoLeadStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABELS[st].label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DemosTableSkeleton() {
  return (
    <div className="space-y-3 rounded-md border p-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-1/4" />
          <Skeleton className="h-10 w-1/4" />
          <Skeleton className="h-10 w-1/6" />
          <Skeleton className="h-10 w-1/6" />
        </div>
      ))}
    </div>
  );
}
