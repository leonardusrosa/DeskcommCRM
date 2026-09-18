import type { SupabaseClient } from "@supabase/supabase-js";
import type { DentalDemoTemplate } from "./types";
import { syntheticDemoChannelSessionRow } from "@/lib/channels/demo-session";

export const DEMO_EMAIL_DOMAIN = "demo.example.invalid";

const DEMO_PHONE_BY_COUNTRY: Record<DentalDemoTemplate["country"], string> = {
  CO: "+573009990001",
  MX: "+525599990001",
  ES: "+34699990001",
  PT: "+351919990001",
};

export function demoEmail(source: string, token: string): string {
  const local = source.split("@")[0]!.replace(/[^a-z0-9._-]/gi, "").toLowerCase() || "user";
  return `${local}+${token}@${DEMO_EMAIL_DOMAIN}`;
}

function schedule(timezone: string) {
  return {
    timezone,
    windows: [
      ...[1, 2, 3, 4, 5].flatMap((dow) => [
        { dow, start: "08:00", end: "12:30" },
        { dow, start: "14:00", end: "18:00" },
      ]),
      { dow: 6, start: "09:00", end: "13:00" },
    ],
  };
}

function serviceCategory(slug: string): "consulta" | "procedimento" | "retorno" {
  if (slug.includes("control") || slug.includes("retorno")) return "retorno";
  if (slug.includes("consulta")) return "consulta";
  return "procedimento";
}

export async function createDemoOrganization(
  admin: SupabaseClient,
  template: DentalDemoTemplate,
  slug: string,
  requestedCompany?: string,
): Promise<string> {
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from("organizations").insert({
    slug,
    display_name: requestedCompany?.trim() || template.orgName,
    legal_name: template.legalName,
    timezone: template.timezone,
    locale: template.locale,
    settings: {
      demo: true,
      synthetic_data: true,
      vertical: "dental-clinic",
      country: template.country,
      currency: template.currency,
      scenario: template.scenario,
      demo_expires_at: expiresAt,
    },
    onboarded_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !data) throw new Error(`Demo organization: ${error?.message || "create failed"}`);
  return String(data.id);
}

export async function createDemoUsers(
  admin: SupabaseClient,
  orgId: string,
  template: DentalDemoTemplate,
  token: string,
  password: string,
): Promise<{
  users: Map<string, { id: string; name: string }>;
  createdUserIds: string[];
}> {
  const users = new Map<string, { id: string; name: string }>();
  const createdUserIds: string[] = [];

  for (const spec of template.users) {
    const email = demoEmail(spec.email, token);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: spec.name,
        title: spec.title,
        locale: template.locale,
        timezone: template.timezone,
        demo: true,
      },
    });
    if (error || !data.user) throw new Error(`Demo user: ${error?.message || "create failed"}`);
    createdUserIds.push(data.user.id);

    const { error: membershipError } = await admin.from("user_organizations").insert({
      user_id: data.user.id,
      organization_id: orgId,
      role: spec.role,
      accepted_at: new Date().toISOString(),
    });
    if (membershipError) throw new Error(`Demo membership: ${membershipError.message}`);
    users.set(spec.key, { id: data.user.id, name: spec.name });
  }

  return { users, createdUserIds };
}

export async function seedDemoInfrastructure(
  admin: SupabaseClient,
  orgId: string,
  template: DentalDemoTemplate,
  token: string,
  users: Map<string, { id: string; name: string }>,
) {
  const providerIds = template.users
    .filter((spec) => spec.isProvider)
    .map((spec) => users.get(spec.key)?.id)
    .filter((id): id is string => Boolean(id));

  for (const userId of providerIds) {
    const { error } = await admin.from("attendant_availability").insert({
      organization_id: orgId,
      user_id: userId,
      is_available: true,
      capacity: 10,
      schedule: schedule(template.timezone),
    });
    if (error) throw new Error(`Demo availability: ${error.message}`);
  }

  const ownerId = users.get("owner")!.id;
  const { data: channel, error: channelError } = await admin
    .from("channel_sessions")
    .insert(
      syntheticDemoChannelSessionRow({
        organizationId: orgId,
        token: `${template.country.toLowerCase()}-${token}`,
        phoneNumber: DEMO_PHONE_BY_COUNTRY[template.country],
        createdBy: ownerId,
      }),
    )
    .select("id")
    .single();
  if (channelError || !channel) {
    throw new Error(`Demo channel: ${channelError?.message || "create failed"}`);
  }

  const eventTypes = new Map<string, string>();
  for (const [index, spec] of template.services.entries()) {
    const { data, error } = await admin.from("calendar_event_types").insert({
      organization_id: orgId,
      name: spec.name,
      slug: spec.slug,
      description: spec.description,
      category: serviceCategory(spec.slug),
      duration_minutes: spec.durationMinutes,
      color: spec.color || "#0284c7",
      default_owner_user_id: ownerId,
      position: (index + 1) * 1000,
      reminder_enabled: false,
    }).select("id").single();
    if (error || !data) throw new Error(`Demo service: ${error?.message || "create failed"}`);
    eventTypes.set(spec.slug, String(data.id));
  }

  const { data: pipeline, error: pipelineError } = await admin.from("crm_pipelines").insert({
    organization_id: orgId,
    name: template.pipeline.name,
    slug: template.pipeline.slug,
    is_default: true,
    vocabulary: {
      lead: "Paciente",
      lead_plural: "Pacientes",
      deal: template.locale === "pt-PT" ? "Tratamento" : "Tratamiento",
      deal_plural: template.locale === "pt-PT" ? "Tratamentos" : "Tratamientos",
      won: template.locale === "pt-PT" ? "Aceite" : "Vendido",
      lost: "Perdido",
      stage: "Etapa",
      stage_plural: "Etapas",
    },
  }).select("id").single();
  if (pipelineError || !pipeline) {
    throw new Error(`Demo pipeline: ${pipelineError?.message || "create failed"}`);
  }

  const stages = new Map<string, string>();
  for (const stage of template.pipeline.stages) {
    const { data, error } = await admin.from("crm_stages").insert({
      organization_id: orgId,
      pipeline_id: String(pipeline.id),
      name: stage.name,
      slug: stage.slug,
      position: stage.position * 1000,
      is_won: Boolean(stage.isWon),
      is_lost: Boolean(stage.isLost),
    }).select("id").single();
    if (error || !data) throw new Error(`Demo stage: ${error?.message || "create failed"}`);
    stages.set(stage.slug, String(data.id));
  }

  return {
    ownerId,
    operatorId: users.get("operator")?.id || ownerId,
    channelId: String(channel.id),
    eventTypes,
    pipelineId: String(pipeline.id),
    stages,
  };
}
