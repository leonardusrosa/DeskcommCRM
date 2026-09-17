import { SalesMobileWorkspace } from "@/components/sales/SalesMobileWorkspace";

export const metadata = {
  title: "Espacio Móvil Comercial — Deskcomm",
  description: "Bandeja de prospectos urgentes, temporizadores de SLA y contacto inmediato para ejecutivos de ventas.",
};

export default function SalesMobilePage() {
  return (
    <main className="min-h-screen bg-muted/20 p-4">
      <header className="max-w-md mx-auto mb-4">
        <h1 className="text-xl font-bold">Ventas Móvil</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Gestión inmediata de prospectos de alta intención y cumplimiento de SLAs en tiempo real.
        </p>
      </header>
      <SalesMobileWorkspace />
    </main>
  );
}
