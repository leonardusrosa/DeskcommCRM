import { ExecutiveRevenueDashboard } from "@/components/admin/revenue/ExecutiveRevenueDashboard";

export const metadata = {
  title: "Ingresos Ejecutivos — Admin Plataforma",
  description: "Visión consolidada de pipeline, forecast ARR, embudo de conversión, CAC y canales.",
};

export default function RevenuePage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Panel Ejecutivo de Ingresos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitorización financiera en tiempo real: volumen de pipeline, proyección ARR, costes de adquisición y rendimiento por canal y territorio.
        </p>
      </div>
      <ExecutiveRevenueDashboard />
    </main>
  );
}
