import type { Metadata } from "next";
import Link from "next/link";
import { DemoBookingForm } from "@/components/demo/DemoBookingForm";
import { Sparkle, Check, Clock } from "@/lib/ui/icons";

export const metadata: Metadata = {
  title: "Agendar Demostración — Deskcomm CRM",
  description: "Agenda una sesión estratégica con un consultor de Deskcomm CRM para clínicas.",
};

const CALL_BENEFITS = [
  "Diagnóstico personalizado del flujo de pacientes de tu clínica",
  "Demostración en vivo de captura por WhatsApp e integración con Google Calendar",
  "Configuración recomendada de pipelines y cálculo de retorno de inversión",
  "Resolución de dudas sobre migración de datos y seguridad clínica",
];

export default function DemoBookPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-muted/30 flex flex-col">
      {/* Top Bar */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/demo" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
              D
            </div>
            <span className="font-semibold text-lg tracking-tight">Deskcomm</span>
          </Link>
          <span className="text-xs bg-primary/15 text-primary font-medium px-2 py-0.5 rounded-full ml-1">
            Ventas 1-a-1
          </span>
        </div>
        <Link
          href="/demo"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Solicitar Demo Instantánea
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Call Details */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkle size={14} className="text-primary" weight="fill" />
            <span>Sesión personalizada de 30 minutos</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
            Agenda una llamada con un especialista de Deskcomm.
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed">
            Analicemos juntos los cuellos de botella de tu recepción médica y te mostraremos en vivo cómo automatizar el agendamiento y seguimiento de consultas.
          </p>

          <div className="space-y-3 pt-4 border-t">
            {CALL_BENEFITS.map((b, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-sm">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary mt-0.5">
                  <Check size={12} weight="bold" />
                </div>
                <span className="text-foreground">{b}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-card border p-4 text-xs text-muted-foreground flex items-center gap-3">
            <Clock size={20} className="text-primary shrink-0" />
            <span>
              Recibirás confirmación inmediata por WhatsApp y un enlace a Google Meet con recordatorio en tu calendario.
            </span>
          </div>
        </div>

        {/* Right Column: Booking Form */}
        <div className="lg:col-span-6 flex justify-center">
          <DemoBookingForm />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Deskcomm CRM. Demostraciones comerciales sin compromiso.</p>
      </footer>
    </div>
  );
}
