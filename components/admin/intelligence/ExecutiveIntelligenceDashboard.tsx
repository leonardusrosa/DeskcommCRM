"use client";

import { useExecutiveIntelligence } from "@/hooks/useExecutiveIntelligence";

export function ExecutiveIntelligenceDashboard() {
  const {
    data,
    loading,
    error,
    actionInProgress,
    refresh,
    approveAction,
    rejectAction,
    executeAction,
    optimizeExperiments,
  } = useExecutiveIntelligence();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Cargando modelos de inteligencia analítica y aprendizaje de ingresos…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error ?? "Sin datos de inteligencia disponibles."}</p>
        <button
          onClick={() => void refresh()}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
        >
          Reintentar sincronización
        </button>
      </div>
    );
  }

  const { warehouse, winLoss, insights, dealRisks, pendingActions, expansionOpportunities } = data;

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Inteligencia de Ingresos & Operaciones Autónomas</h2>
          <p className="text-xs text-muted-foreground">
            Modelado predictivo, detección de patrones win/loss y supervisión humana de agentes comerciales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void optimizeExperiments()}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors"
          >
            Optimizar Experimentos A/B
          </button>
          <button
            onClick={() => void refresh()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Warehouse KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">MRR Analítico Proyectado</span>
          <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            ${warehouse.totalMrrUsd.toLocaleString()} USD
          </div>
          <span className="text-[11px] text-muted-foreground">ARR: ${warehouse.totalArrUsd.toLocaleString()} USD</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">Eficiencia LTV:CAC</span>
          <div className="mt-1 text-2xl font-bold tracking-tight text-emerald-500">
            {warehouse.ltvToCacRatio > 0 ? `${warehouse.ltvToCacRatio}x` : "N/A"}
          </div>
          <span className="text-[11px] text-muted-foreground">Recuperación: {warehouse.paybackMonths} meses</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">Tasa de Conversión Global</span>
          <div className="mt-1 text-2xl font-bold tracking-tight text-blue-500">
            {Math.round(winLoss.overallWinRate * 100)}%
          </div>
          <span className="text-[11px] text-muted-foreground">{winLoss.totalWins} cierres de {winLoss.totalClosed} acuerdos</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">Oportunidades de Expansión</span>
          <div className="mt-1 text-2xl font-bold tracking-tight text-purple-500">
            {expansionOpportunities.length} Clínicas
          </div>
          <span className="text-[11px] text-muted-foreground">Potencial: +${expansionOpportunities.reduce((s, o) => s + o.estimatedExpansionMrr, 0).toLocaleString()} USD/m</span>
        </div>
      </div>

      {/* Confidence-Scored Revenue Insights */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Hallazgos Algorítmicos Basados en Confianza</h3>
          <span className="text-xs text-muted-foreground font-mono">{insights.length} patrones detectados</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {insights.map((ins) => (
            <div key={ins.id} className="flex flex-col justify-between rounded-lg border border-border/80 bg-background/50 p-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold line-clamp-1">{ins.title}</span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {Math.round(ins.confidence * 100)}% Confianza
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{ins.summary}</p>
              </div>
              <div className="mt-3 border-t border-border/40 pt-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Recomendación:</span>
                <ul className="mt-1 space-y-1">
                  {ins.recommendations.map((rec, i) => (
                    <li key={i} className="text-[11px] text-foreground/80 list-disc list-inside">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Human-in-the-Loop Sales Agent Approval Queue */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Cola de Aprobación del Asistente Comercial Autónomo</h3>
            <p className="text-xs text-emerald-500 font-medium">
              Garantía de Seguridad: Cero comunicación externa despachada sin aprobación explícita de un operador.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {pendingActions.length} acciones registradas
          </span>
        </div>

        {pendingActions.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
            No hay acciones pendientes de aprobación. El asistente está monitoreando el flujo comercial.
          </div>
        ) : (
          <div className="divide-y divide-border border rounded-lg overflow-hidden">
            {pendingActions.map((action) => (
              <div key={action.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-background/40">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">{action.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                      action.status === "approved" ? "bg-emerald-500/10 text-emerald-500" :
                      action.status === "rejected" ? "bg-destructive/10 text-destructive" :
                      action.status === "executed" ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {action.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{action.rationale}</p>
                  <div className="text-[11px] font-mono text-foreground/70 bg-muted/40 p-2 rounded border border-border/50">
                    <span className="text-muted-foreground">Destinatario ({action.proposedPayload.channel}):</span> {action.proposedPayload.recipient}
                    <br />
                    <span className="text-muted-foreground">Mensaje:</span> &quot;{action.proposedPayload.body}&quot;
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {action.status === "pending_approval" && (
                    <>
                      <button
                        onClick={() => void approveAction(action.id)}
                        disabled={actionInProgress === action.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => void rejectAction(action.id, "Rechazado por operador")}
                        disabled={actionInProgress === action.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-destructive hover:bg-destructive/90 text-white transition-colors"
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                  {action.status === "approved" && (
                    <button
                      onClick={() => void executeAction(action.id)}
                      disabled={actionInProgress === action.id}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Ejecutar Envío
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deal Risk Radar & Expansion Opportunities Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Deal Risk Radar */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Radar de Riesgo en Acuerdos Abiertos</h3>
          <div className="space-y-3">
            {dealRisks.map((deal) => (
              <div key={deal.dealId} className="p-3 rounded-lg border border-border bg-background/50 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{deal.tenantId}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    deal.riskLevel === "critical" ? "bg-red-500/20 text-red-500" :
                    deal.riskLevel === "high" ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500"
                  }`}>
                    Riesgo {deal.riskLevel} ({deal.riskScore}/100)
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{deal.actionablePlaybook.recommendedAction}</p>
                <div className="mt-2 text-[11px] text-foreground/80">
                  <span className="font-medium text-muted-foreground">Tiempo en etapa:</span> {deal.stageDurationDays} días | <span className="font-medium text-muted-foreground">Inactividad:</span> {deal.inactivityHours}h
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expansion Opportunities */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Oportunidades de Expansión & Upsell</h3>
          <div className="space-y-3">
            {expansionOpportunities.map((opp) => (
              <div key={opp.id} className="p-3 rounded-lg border border-border bg-background/50 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{opp.clinicName}</span>
                  <span className="text-emerald-500 font-bold">+${opp.estimatedExpansionMrr} {opp.currency}/m</span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  Tipo: <span className="font-medium text-foreground">{opp.type.replace(/_/g, " ")}</span> ({opp.currentPlan} &rarr; {opp.recommendedPlan})
                </div>
                <p className="mt-1 text-[11px] text-foreground/80">{opp.recommendedPitch}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
