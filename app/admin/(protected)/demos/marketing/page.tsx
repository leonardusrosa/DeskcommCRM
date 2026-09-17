import { DemoMarketingDashboard } from "@/components/admin/demos/DemoMarketingDashboard";

export const metadata = {
  title: "Marketing y Atribución — Admin Plataforma",
  description: "Rendimiento de fuentes de tráfico, campañas de adquisición y experimentos A/B.",
};

export default function DemoMarketingPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing y Atribución</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rastreo de canales de entrada, efectividad de campañas, tasas de conversión y retorno de inversión en demos.
        </p>
      </div>
      <DemoMarketingDashboard />
    </main>
  );
}
