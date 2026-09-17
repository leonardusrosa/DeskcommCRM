import { SalesPerformanceDashboard } from "@/components/admin/sales/SalesPerformanceDashboard";

export const metadata = {
  title: "Rendimiento Comercial — Admin Plataforma",
  description: "Métricas de ejecución del equipo de ventas, tiempos de respuesta y cierre de demos.",
};

export default function SalesPerformancePage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rendimiento Comercial</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Supervisión de vendedores: asignaciones de demos, agilidad de contacto, reuniones agendadas y facturación generada.
        </p>
      </div>
      <SalesPerformanceDashboard />
    </main>
  );
}
