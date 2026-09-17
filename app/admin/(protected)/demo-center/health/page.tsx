import { DemoHealthObservability } from "@/components/admin/demo-center/DemoHealthObservability";

export const metadata = {
  title: "Salud y Observabilidad Demo — Admin Plataforma",
  description: "Telemetría de la cola de tareas, errores dead-letter, latencia y sincronización CRM.",
};

export default function DemoCenterHealthPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Salud y Observabilidad</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitorización en vivo de la infraestructura operativa: cola de automatizaciones, reintentos con backoff, alertas y sincronización con CRMs externos.
        </p>
      </div>
      <DemoHealthObservability />
    </main>
  );
}
