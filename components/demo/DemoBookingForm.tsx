"use client";

import { useDemoBooking } from "@/hooks/useDemoBooking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, CircleNotch, Warning, Clock, ArrowSquareOut } from "@/lib/ui/icons";

export function DemoBookingForm() {
  const {
    formData,
    loading,
    error,
    confirmation,
    availableSlots,
    updateField,
    submitBooking,
  } = useDemoBooking();

  if (confirmation) {
    return (
      <Card className="w-full max-w-lg shadow-xl border-primary/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
            <CheckCircle size={28} weight="fill" />
          </div>
          <CardTitle className="text-2xl">¡Reunión Agendada con Éxito!</CardTitle>
          <CardDescription>
            Hemos reservado tu sesión demostrativa exclusiva con un especialista de Deskcomm.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/60 p-4 text-sm space-y-2 border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha:</span>
              <span className="font-medium text-foreground">{confirmation.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hora:</span>
              <span className="font-medium text-foreground">{confirmation.time} (hora local)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tema:</span>
              <span className="font-medium text-foreground">{confirmation.topic}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t mt-2">
              <span className="text-muted-foreground">Enlace de videollamada:</span>
              <a
                href={confirmation.meetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary font-mono inline-flex items-center gap-1 hover:underline"
              >
                Google Meet <ArrowSquareOut size={12} />
              </a>
            </div>
          </div>
          <Button asChild className="w-full" variant="outline">
            <a href="/login">Ir a mi Demo Activa →</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Agendar Demostración Personalizada</CardTitle>
        <CardDescription>
          Descubre cómo multiplicar la conversión de consultas dentales con un experto de Deskcomm.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submitBooking} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              <Warning size={18} weight="fill" className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selector de Fecha y Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="book-date">Fecha Deseada</Label>
              <Input
                id="book-date"
                type="date"
                required
                value={formData.date}
                onChange={(e) => updateField("date", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Horario Disponible</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {availableSlots.map((slot) => {
                  const isSelected = formData.time === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => updateField("time", slot)}
                      className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tema de Demostración */}
          <div className="space-y-1">
            <Label htmlFor="book-topic">Enfoque Principal</Label>
            <select
              id="book-topic"
              value={formData.topic}
              onChange={(e) => updateField("topic", e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="Demostración completa y WhatsApp">
                Demostración completa y gestión de WhatsApp
              </option>
              <option value="Sincronización con Google Calendar">
                Sincronización y agenda con Google Calendar
              </option>
              <option value="Configuración de embudos y precios">
                Estructura de pipeline odontológico y planes
              </option>
            </select>
          </div>

          {/* Datos del contacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="book-name">Tu Nombre</Label>
              <Input
                id="book-name"
                required
                placeholder="Dr. Gabriel Ortiz"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="book-company">Clínica / Empresa</Label>
              <Input
                id="book-company"
                required
                placeholder="Clínica Sonrisas"
                value={formData.company}
                onChange={(e) => updateField("company", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="book-email">Correo Electrónico</Label>
              <Input
                id="book-email"
                type="email"
                required
                placeholder="gabriel@clinica.com"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="book-whatsapp">WhatsApp</Label>
              <Input
                id="book-whatsapp"
                type="tel"
                required
                placeholder="+57 300 000 0000"
                value={formData.whatsapp}
                onChange={(e) => updateField("whatsapp", e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
            {loading ? (
              <>
                <CircleNotch size={18} className="animate-spin mr-2" />
                Confirmando disponibilidad...
              </>
            ) : (
              <>
                <Clock size={18} className="mr-2" />
                Confirmar Cita Comercial
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
