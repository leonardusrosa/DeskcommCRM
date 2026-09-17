"use client";

import { useDemoIntegrations } from "@/hooks/useDemoIntegrations";

export function DemoIntegrationsMarketplace() {
  const { integrations, loading, error, activeTab, setActiveTab, refetch } = useDemoIntegrations();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Cargando catálogo de integraciones…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center max-w-md mx-auto">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => void refetch()}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("all")}
          className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "all"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setActiveTab("crm")}
          className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "crm"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          CRMs Externos
        </button>
        <button
          onClick={() => setActiveTab("messaging")}
          className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "messaging"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Mensajería & WhatsApp
        </button>
        <button
          onClick={() => setActiveTab("automation")}
          className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "automation"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Plataformas de Automatización
        </button>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {integrations.map((item) => {
          const statusColor =
            item.status === "connected"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200"
              : item.status === "configured"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200"
              : "bg-muted text-muted-foreground border-border";

          const statusLabel =
            item.status === "connected"
              ? "Conectado"
              : item.status === "configured"
              ? "Configurado"
              : "Disponible";

          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-base">{item.name}</h3>
                    <span className="text-[11px] uppercase font-mono text-muted-foreground">
                      {item.authType.replace("_", " ")}
                    </span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>

                {item.lastSyncAt && (
                  <div className="pt-2 text-[11px] text-muted-foreground flex justify-between border-t border-border/50">
                    <span>Salud sync: {item.healthRatePercentage}%</span>
                    <span>{new Date(item.lastSyncAt).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  className="w-full py-2 px-3 rounded-lg border border-border bg-background hover:bg-accent text-foreground text-xs font-medium transition-colors"
                >
                  {item.status === "connected" ? "Administrar Conexión" : "Conectar Plataforma"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
