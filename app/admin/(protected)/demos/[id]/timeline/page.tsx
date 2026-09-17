import Link from "next/link";
import { DemoTimelineView } from "@/components/admin/demos/DemoTimelineView";

export const metadata = {
  title: "Cronología de Demostración — Admin Plataforma",
  description: "Línea de tiempo de eventos comerciales y actividad del prospecto.",
};

export default async function DemoTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href="/admin/demos" className="hover:underline">
              Demostraciones
            </Link>
            <span>/</span>
            <span className="font-mono">{id}</span>
            <span>/</span>
            <span>Cronología</span>
          </div>
          <h1 className="text-2xl font-bold">Línea de Tiempo del Lead</h1>
        </div>
      </div>
      <DemoTimelineView tenantId={id} />
    </main>
  );
}
