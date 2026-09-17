import type { Metadata } from "next";
import Link from "next/link";
import { DemoRequestForm } from "@/components/demo/DemoRequestForm";
import { ChatsCircle, Kanban, Clock, Sparkle } from "@/lib/ui/icons";

export const metadata: Metadata = {
  title: "Demostración Interactiva — Deskcomm CRM",
  description: "Solicita acceso instantáneo a un entorno preconfigurado de Deskcomm CRM para clínicas dentales.",
};

const HIGHLIGHTS = [
  {
    icon: ChatsCircle,
    title: "WhatsApp & Inbox Unificado",
    desc: "Conversaciones comerciales activas con pacientes listos para agendar tratamiento.",
  },
  {
    icon: Kanban,
    title: "Pipeline Odontológico",
    desc: "Embudos adaptados a presupuestos, consultas de valoración y tratamientos recurrentes.",
  },
  {
    icon: Clock,
    title: "Agenda Multi-Profesional",
    desc: "Citas y disponibilidad en tiempo real conectadas con Google Calendar.",
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-muted/30 flex flex-col">
      {/* Top Bar */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            D
          </div>
          <span className="font-semibold text-lg tracking-tight">Deskcomm</span>
          <span className="text-xs bg-primary/15 text-primary font-medium px-2 py-0.5 rounded-full ml-1">
            Demo Factory
          </span>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          ¿Ya tienes cuenta? Iniciar Sesión →
        </Link>
      </header>

      {/* Hero & Form */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Value Prop */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkle size={14} className="text-primary" weight="fill" />
            <span>Ambientes de prueba aislados y realistas</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
            Experimenta el CRM diseñado para convertir más pacientes.
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed">
            Descubre cómo Deskcomm transforma la recepción, seguimiento y agenda de tu clínica dental en un motor predecible de ventas y fidelización.
          </p>

          <div className="space-y-4 pt-4 border-t">
            {HIGHLIGHTS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
                    <Icon size={20} weight="regular" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Form */}
        <div className="lg:col-span-6 flex justify-center">
          <DemoRequestForm />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Deskcomm CRM. Todos los derechos reservados. Entornos de demostración protegidos.</p>
      </footer>
    </div>
  );
}
