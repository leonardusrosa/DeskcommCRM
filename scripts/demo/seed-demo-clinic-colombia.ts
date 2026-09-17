/**
 * scripts/demo/seed-demo-clinic-colombia.ts
 *
 * Demo Tenant Factory — Clínica Sonrisa Bogotá 🇨🇴
 * Provisions a complete, realistic dental clinic demo tenant for sales presentations.
 *
 * Requirements:
 *   DEMO_SEED_ALLOWED=true
 *   DEMO_USER_PASSWORD=<secure_password>
 *
 * Usage:
 *   pnpm demo:seed:colombia
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSafetyGuards } from "./lib/guards";
import { ensureDemoOrg, ensureDemoUsers } from "./lib/provision-org-users";
import { ensureClinicAvailability } from "./lib/provision-availability";
import { ensureClinicEventTypes } from "./lib/provision-services";
import { ensureClinicPipeline } from "./lib/provision-pipeline";
import { ensureClinicContactsAndLeads } from "./lib/provision-contacts-leads";
import { ensureClinicAppointments } from "./lib/provision-appointments";
import {
  DEMO_CLINIC_NAME,
  DEMO_CLINIC_SLUG,
  DEMO_CLINIC_LOCALE,
  DEMO_CLINIC_TIMEZONE,
  DEMO_CLINIC_COUNTRY,
  type DemoSeedSummary,
} from "./lib/types";

export async function runClinicSeed(
  customEnv?: Record<string, string | undefined>,
  customAdmin?: SupabaseClient,
): Promise<DemoSeedSummary> {
  // 1. Safety verification
  const { supabaseUrl, serviceRoleKey, userPassword } = assertSafetyGuards(customEnv);

  const admin =
    customAdmin ??
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  console.info(`\n🏥 [demo:seed:colombia] Iniciando aprovisionamiento de ${DEMO_CLINIC_NAME}...`);

  // 2. Organization
  const orgId = await ensureDemoOrg(admin);
  console.info(`   ✔ Organización asegurada: ${orgId}`);

  // 3. Users & Memberships
  const usersMap = await ensureDemoUsers(admin, orgId, userPassword);
  console.info(`   ✔ ${usersMap.size} usuarios asegurados (owner, operadora, odontólogos)`);

  // 4. Team Availability
  const providerIds = Array.from(usersMap.values())
    .filter((u) => u.isProvider)
    .map((u) => u.id);
  await ensureClinicAvailability(admin, orgId, providerIds);
  console.info(`   ✔ Disponibilidad de equipo configurada (Lun-Vie 08:00-18:00 con receso, Sáb 09:00-13:00)`);

  // 5. Appointment Types / Services
  const ownerId = usersMap.get("owner")?.id;
  const eventTypesMap = await ensureClinicEventTypes(admin, orgId, ownerId);
  console.info(`   ✔ ${eventTypesMap.size} servicios odontológicos configurados`);

  // 6. Pipeline & Stages
  const { pipelineId, stages: stagesMap } = await ensureClinicPipeline(admin, orgId);
  console.info(`   ✔ Pipeline de ventas creado con ${stagesMap.size} etapas clínicas`);

  // 7. Contacts, Leads & Realistic Conversations
  const contactsMap = await ensureClinicContactsAndLeads(admin, orgId, pipelineId, stagesMap, usersMap);
  console.info(`   ✔ ${contactsMap.size} contactos con historial de conversaciones de WhatsApp creados`);

  // 8. Appointments
  const appointments = await ensureClinicAppointments(admin, orgId, eventTypesMap, usersMap, contactsMap);
  console.info(`   ✔ ${appointments.length} citas de agenda creadas (futuras e historial)`);

  const summary: DemoSeedSummary = {
    tenantId: orgId,
    tenantName: DEMO_CLINIC_NAME,
    slug: DEMO_CLINIC_SLUG,
    locale: DEMO_CLINIC_LOCALE,
    timezone: DEMO_CLINIC_TIMEZONE,
    users: Array.from(usersMap.values()).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
    })),
    services: Array.from(eventTypesMap.values()).map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
    })),
    contacts: Array.from(contactsMap.values()).map((c) => ({
      id: c.contactId,
      name: c.name,
      phone: c.phone,
      stage: c.stageName,
    })),
    appointments,
  };

  printSummary(summary);
  return summary;
}

function printSummary(s: DemoSeedSummary): void {
  console.info("\n" + "=".repeat(70));
  console.info(`✨ DEMO TENANT FACTORY — ${s.tenantName.toUpperCase()} 🇨🇴`);
  console.info("=".repeat(70));
  console.info(`\n📌 ORGANIZACIÓN:`);
  console.info(`   • ID:       ${s.tenantId}`);
  console.info(`   • Slug:     ${s.slug}`);
  console.info(`   • País:     ${DEMO_CLINIC_COUNTRY} | Idioma: ${s.locale} | Fuso: ${s.timezone}`);
  console.info(`   • Industria: Clínica Odontológica (Dental Clinic)`);

  console.info(`\n👥 USUARIOS DEMO CREADOS:`);
  for (const u of s.users) {
    console.info(`   • [${u.role.toUpperCase().padEnd(6)}] ${u.name.padEnd(25)} <${u.email}>`);
  }

  console.info(`\n🦷 SERVICIOS / TIPOS DE CITA:`);
  for (const srv of s.services) {
    console.info(`   • ${srv.name.padEnd(28)} (${srv.durationMinutes} min)`);
  }

  console.info(`\n📋 CONTACTOS & PIPELINE:`);
  for (const c of s.contacts) {
    console.info(`   • ${c.name.padEnd(22)} (${c.phone}) → Etapa: ${c.stage}`);
  }

  console.info(`\n📅 CITAS EN AGENDA:`);
  for (const a of s.appointments) {
    console.info(
      `   • ${a.title.padEnd(42)} [${a.status.toUpperCase()}] ${a.startsAt} (Dr/a: ${a.provider})`,
    );
  }

  console.info(`\n🔗 GOOGLE CALENDAR DEMO:`);
  console.info(`   • Estado: Listo para conectar normalmente por la interfaz.`);
  console.info(`   • Zero credenciales o tokens simulados (100% flujo OAuth oficial).`);

  console.info("\n" + "=".repeat(70));
  console.info(`🚀 Listo para demostración comercial en menos de 2 minutos.`);
  console.info("=".repeat(70) + "\n");
}

if (require.main === module) {
  runClinicSeed().catch((err) => {
    console.error(`\n❌ Error durante el aprovisionamiento de demo:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
