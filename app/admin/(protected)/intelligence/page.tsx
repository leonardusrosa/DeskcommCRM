import { ExecutiveIntelligenceDashboard } from "@/components/admin/intelligence/ExecutiveIntelligenceDashboard";

export const metadata = {
  title: "Inteligencia de Ingresos — Admin Plataforma",
  description: "Operaciones autónomas de ingresos, modelado win/loss, supervisión de agentes y análisis de expansión.",
};

export default function IntelligencePage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inteligencia de Ingresos & Operaciones Autónomas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Modelado predictivo de ciclo comercial, detección algorítmica de riesgos y cola de aprobación para agentes.
        </p>
      </div>
      <ExecutiveIntelligenceDashboard />
    </main>
  );
}
