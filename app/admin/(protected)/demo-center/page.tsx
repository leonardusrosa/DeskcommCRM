import { DemoCenterDashboard } from "@/components/admin/demo-center/DemoCenterDashboard";

export const metadata = {
  title: "Centro de Control Demo — Admin Plataforma",
  description: "Consola de operaciones comercial y operativa de demostraciones en vivo.",
};

export default function DemoCenterPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Centro de Control Demo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visibilidad unificada en tiempo real: demos activas, alta intención de compra, cumplimiento de SLA, alertas y proyección de ingresos.
        </p>
      </div>
      <DemoCenterDashboard />
    </main>
  );
}
