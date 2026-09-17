import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateDemoPassword, saveDemoSession } from "@/scripts/demo/lib/demo-session";
import { createDemoLead } from "@/scripts/demo/lib/demo-leads";
import { seedDemoProfile } from "@/scripts/demo/profiles/engine";
import { colombiaDentalProfile } from "@/scripts/demo/profiles/dental-clinic/colombia";
import { mexicoDentalProfile } from "@/scripts/demo/profiles/dental-clinic/mexico";
import { spainDentalProfile } from "@/scripts/demo/profiles/dental-clinic/spain";
import { portugalDentalProfile } from "@/scripts/demo/profiles/dental-clinic/portugal";

const PRODUCTION_PROJECT_REF = "zywwwvrotgqouxillpvi";

const demoRequestSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  company: z.string().min(2, "El nombre de la empresa/clínica es obligatorio"),
  country: z.string().min(2).max(2).toUpperCase(),
  vertical: z.string().default("dental-clinic"),
  email: z.string().email("Correo electrónico no válido"),
  whatsapp: z.string().min(6, "Número de WhatsApp no válido"),
});

function resolveProfile(country: string) {
  switch (country.toUpperCase()) {
    case "MX":
      return mexicoDentalProfile;
    case "ES":
      return spainDentalProfile;
    case "PT":
      return portugalDentalProfile;
    case "CO":
    default:
      return colombiaDentalProfile;
  }
}

export async function POST(req: NextRequest) {
  // 1. Safety verification: strict production block
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(PRODUCTION_PROJECT_REF) ||
    process.env.SUPABASE_URL?.includes(PRODUCTION_PROJECT_REF) ||
    process.env.SUPABASE_DB_URL?.includes(PRODUCTION_PROJECT_REF);

  if (isProduction) {
    return NextResponse.json(
      { success: false, error: "Demo provisioning is strictly prohibited in production." },
      { status: 403 },
    );
  }

  // 2. Request body parsing and validation
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Cuerpo de solicitud JSON no válido." },
      { status: 400 },
    );
  }

  const parsed = demoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Datos de solicitud no válidos",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { name, company, country, vertical, email, whatsapp } = parsed.data;
  const profile = resolveProfile(country);
  const password = generateDemoPassword("DemoUser");

  try {
    // 3. Provision demo tenant environment
    const customEnv = {
      ...process.env,
      DEMO_SEED_ALLOWED: "true",
      DEMO_USER_PASSWORD: password,
    };

    const summary = await seedDemoProfile(profile, customEnv);

    // 4. Record commercial demo lead (isolated from customer CRM)
    await createDemoLead({
      name,
      company,
      country,
      vertical,
      email,
      whatsapp,
      demo_tenant_id: summary.tenantId,
      status: "demo_created",
    });

    // 5. Store session locally
    saveDemoSession({
      tenant: summary.slug,
      email: summary.users[0]?.email || email,
      password,
      clinicName: company || summary.tenantName,
      country,
    });

    return NextResponse.json({
      success: true,
      redirectUrl: "/login",
      tenantId: summary.tenantId,
      credentials: {
        email: summary.users[0]?.email,
        password,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al crear la demo.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
