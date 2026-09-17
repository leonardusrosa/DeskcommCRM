import { SLAAnalyticsDashboard } from "@/components/admin/sales/SLAAnalyticsDashboard";

export const metadata = {
  title: "Analítica de SLAs — Admin Plataforma",
  description: "Métricas históricas de cumplimiento de SLA, tiempos de respuesta y detección de cuellos de botella.",
};

export default function SLAAnalyticsPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analítica de SLAs y Cumplimiento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Supervisión de tiempos de respuesta por tipo de acción comercial, resolución a tiempo y auditoría de incidencias.
        </p>
      </div>
      <SLAAnalyticsDashboard />
    </main>
  );
}
