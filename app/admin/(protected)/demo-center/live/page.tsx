import { LiveDemoCenterDashboard } from "@/components/admin/demo-center/LiveDemoCenterDashboard";

export const metadata = {
  title: "Centro de Mando en Vivo — Admin Plataforma",
  description: "Monitorización en tiempo real del bus de eventos, worker de fondo, demos activas y alertas de SLA.",
};

export default function LiveDemoCenterPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Centro de Mando en Tiempo Real</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transmisión continua de eventos comerciales, cola de trabajos del worker, estado de salud de demos y alertas SLA.
        </p>
      </div>
      <LiveDemoCenterDashboard />
    </main>
  );
}
