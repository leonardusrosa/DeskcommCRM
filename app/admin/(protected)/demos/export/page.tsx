import { DemoExportView } from "@/components/admin/demos/DemoExportView";

export const metadata = {
  title: "Exportar Demos — Admin Plataforma",
  description: "Descarga de datos de demostraciones y prospectos en formato CSV y JSON.",
};

export default function DemoExportPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exportación de Datos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Descarga y auditoría de prospectos de demostración, métricas de salud y fechas de vigencia.
        </p>
      </div>
      <DemoExportView />
    </main>
  );
}
