import { DemoAnalyticsDashboard } from "@/components/admin/demos/DemoAnalyticsDashboard";

export const metadata = {
  title: "Analytics Demo — Admin Plataforma",
  description: "Revenue operations e métricas de conversão do Demo Factory.",
};

export default function AdminDemosAnalyticsPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demo Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas de revenue operations em tempo real para o Demo Factory.
        </p>
      </div>
      <DemoAnalyticsDashboard />
    </main>
  );
}
