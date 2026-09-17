import { DemoIntegrationsMarketplace } from "@/components/admin/demo-center/DemoIntegrationsMarketplace";

export const metadata = {
  title: "Catálogo de Integraciones — Admin Plataforma",
  description: "Conexión de Deskcomm con CRMs externos, pasarelas de WhatsApp y motores de automatización.",
};

export default function DemoCenterIntegrationsPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogo de Integraciones</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ecosistema de conectividad para sincronización de contactos comerciales, mensajería instantánea y webhooks salientes.
        </p>
      </div>
      <DemoIntegrationsMarketplace />
    </main>
  );
}
