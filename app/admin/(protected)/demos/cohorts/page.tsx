import { DemoCohortsTable } from "@/components/admin/demos/DemoCohortsTable";

export const metadata = {
  title: "Cohortes de Demostración — Admin Plataforma",
  description: "Análisis de cohortes por país, vertical y mes de creación.",
};

export default function AdminDemosCohortsPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cohortes de Demostración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rendimiento y conversión de prospectos agrupados por país, sector comercial y periodo de adquisición.
        </p>
      </div>
      <DemoCohortsTable />
    </main>
  );
}
