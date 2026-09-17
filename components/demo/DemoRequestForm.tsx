"use client";

import { useDemoRequest } from "@/hooks/useDemoRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleNotch, CheckCircle, Warning } from "@/lib/ui/icons";

const COUNTRIES = [
  { code: "CO", label: "Colombia", flag: "🇨🇴", city: "Bogotá" },
  { code: "MX", label: "México", flag: "🇲🇽", city: "CDMX" },
  { code: "ES", label: "España", flag: "🇪🇸", city: "Madrid" },
  { code: "PT", label: "Portugal", flag: "🇵🇹", city: "Lisboa" },
];

const VERTICALS = [
  { id: "dental-clinic", label: "Clínica Odontológica", badge: "Demo Activa" },
];

export function DemoRequestForm() {
  const {
    formData,
    loading,
    error,
    createdCredentials,
    updateField,
    submitDemoRequest,
  } = useDemoRequest();

  if (createdCredentials) {
    return (
      <Card className="w-full max-w-lg shadow-lg border-primary/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
            <CheckCircle size={28} weight="fill" />
          </div>
          <CardTitle className="text-2xl">¡Tu Demo está lista!</CardTitle>
          <CardDescription>
            Ambiente comercial configurado. Redirigiendo al inicio de sesión...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/60 p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Usuario:</span>
              <span className="font-mono font-medium">{createdCredentials.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contraseña temporal:</span>
              <span className="font-mono font-medium">{createdCredentials.password}</span>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground animate-pulse">
            Abriendo Deskcomm CRM...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Solicitar Demostración Comercial</CardTitle>
        <CardDescription>
          Experimenta Deskcomm con datos clínicos reales, WhatsApp preconfigurado y agenda activa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submitDemoRequest} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              <Warning size={18} weight="fill" className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selector de País */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              País y Región
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {COUNTRIES.map((c) => {
                const isSelected = formData.country === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => updateField("country", c.code)}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2.5 text-xs transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-medium ring-2 ring-primary/20"
                        : "border-border hover:bg-accent/50 text-muted-foreground"
                    }`}
                  >
                    <span className="text-xl mb-1">{c.flag}</span>
                    <span>{c.label}</span>
                    <span className="text-[10px] text-muted-foreground">{c.city}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selector de Vertical */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sector / Vertical
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {VERTICALS.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border border-primary/50 bg-primary/5 p-3 text-sm"
                >
                  <span className="font-medium text-foreground">{v.label}</span>
                  <span className="rounded bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {v.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Datos de Contacto */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="demo-name">Nombre y Apellido</Label>
              <Input
                id="demo-name"
                required
                placeholder="Dra. Mariana López"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="demo-company">Clínica u Organización</Label>
              <Input
                id="demo-company"
                required
                placeholder="Dental Studio Bogotá"
                value={formData.company}
                onChange={(e) => updateField("company", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="demo-email">Correo Electrónico Profesional</Label>
            <Input
              id="demo-email"
              type="email"
              required
              placeholder="contacto@tudominio.com"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="demo-whatsapp">WhatsApp de Contacto</Label>
            <Input
              id="demo-whatsapp"
              type="tel"
              required
              placeholder="+57 300 123 4567"
              value={formData.whatsapp}
              onChange={(e) => updateField("whatsapp", e.target.value)}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
            {loading ? (
              <>
                <CircleNotch size={18} className="animate-spin mr-2" />
                Configurando tu entorno comercial...
              </>
            ) : (
              "Comenzar Demostración Inmediata"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
