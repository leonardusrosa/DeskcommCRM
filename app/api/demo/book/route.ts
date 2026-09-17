import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackConversionEvent } from "@/scripts/demo/lib/demo-conversion-events";
import { listDemoLeads, updateDemoLeadStatus } from "@/scripts/demo/lib/demo-leads";

const bookingSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  email: z.string().email("Correo no válido"),
  whatsapp: z.string().min(6, "WhatsApp no válido"),
  company: z.string().min(2, "Empresa requerida"),
  date: z.string().min(10, "Fecha requerida"),
  time: z.string().min(4, "Hora requerida"),
  topic: z.string().default("Demostración personalizada"),
  tenantId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Datos de reserva inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, email, whatsapp, company, date, time, topic, tenantId: providedTenantId } =
    parsed.data;

  // Resolve associated demo tenant
  let targetTenantId = providedTenantId;
  if (!targetTenantId) {
    const allLeads = listDemoLeads();
    const matchedLead = allLeads.find(
      (l) => l.email.toLowerCase() === email.toLowerCase() || l.whatsapp === whatsapp,
    );
    targetTenantId = matchedLead?.demo_tenant_id || `demo-booking-${Date.now()}`;
  }

  try {
    // 1. Record commercial conversion event
    const event = await trackConversionEvent(targetTenantId, "meeting_booked", {
      name,
      email,
      whatsapp,
      company,
      date,
      time,
      topic,
    });

    // 2. Advance demo lead status to meeting_booked
    updateDemoLeadStatus(targetTenantId, "meeting_booked");

    const meetUrl = `https://meet.google.com/dsk-${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 5)}`;

    return NextResponse.json({
      success: true,
      bookingId: event.id,
      meetingDetails: {
        date,
        time,
        topic,
        meetUrl,
        leadName: name,
        company,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Error al procesar la reserva",
      },
      { status: 500 },
    );
  }
}
