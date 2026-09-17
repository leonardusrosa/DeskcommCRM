import { DemoCatalogList } from "@/components/demo/DemoCatalogList";

export const metadata = {
  title: "Catálogo de Demos por Especialidad — Deskcomm",
  description: "Explora y solicita entornos interactivos adaptados a clínicas dentales, centros estéticos, veterinarias y policlínicos.",
};

export default function DemoCatalogPage() {
  return (
    <main className="min-h-screen p-6 md:p-12 max-w-6xl mx-auto space-y-8">
      <header className="space-y-2 text-center md:text-left">
        <span className="text-xs uppercase font-bold tracking-wider text-primary">
          Marketplace de Demostraciones
        </span>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Elige el Entorno Perfecto para tu Clínica
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
          Demostraciones en vivo con datos realistas, flujos de WhatsApp integrados, calendarios médicos sincronizados y configuraciones específicas para tu sector.
        </p>
      </header>
      <DemoCatalogList />
    </main>
  );
}
