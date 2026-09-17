import { SalesWorkspaceDashboard } from "@/components/admin/sales/SalesWorkspaceDashboard";

export const metadata = {
  title: "Espacio de Ventas — Admin Plataforma",
  description: "Bandeja de operaciones comerciales y seguimiento de demostraciones.",
};

export default function AdminSalesPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Espacio de Ventas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Priorización de tareas operativas: acciones con SLA, follow-ups de cadencia, demos por expirar y leads con alta intención de compra.
        </p>
      </div>
      <SalesWorkspaceDashboard />
    </main>
  );
}
