/**
 * scripts/demo/lib/provision-pipeline.ts
 *
 * Provision pipeline and custom stages for Clínica Sonrisa Bogotá.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoStageSpec } from "./types";

export const DEMO_STAGES_SPECS: DemoStageSpec[] = [
  { name: "Nuevo contacto", slug: "nuevo_contacto", position: 1000 },
  { name: "Primera conversación", slug: "primera_conversacion", position: 2000 },
  { name: "Interesado", slug: "interesado", position: 3000 },
  { name: "Consulta agendada", slug: "consulta_agendada", position: 4000 },
  { name: "Tratamiento vendido", slug: "tratamiento_vendido", position: 5000, isWon: true },
  { name: "Paciente recurrente", slug: "paciente_recurrente", position: 6000 },
];

export const DEMO_PIPELINE_SLUG = "tratamientos-odontologicos";
export const DEMO_PIPELINE_NAME = "Tratamientos Odontológicos";

export async function ensureClinicPipeline(
  admin: SupabaseClient,
  orgId: string,
): Promise<{ pipelineId: string; stages: Map<string, { id: string; name: string; slug: string }> }> {
  const { data: existingPipe } = await admin
    .from("crm_pipelines")
    .select("id")
    .eq("organization_id", orgId)
    .eq("slug", DEMO_PIPELINE_SLUG)
    .maybeSingle();

  let pipelineId: string;

  if (existingPipe) {
    pipelineId = (existingPipe as { id: string }).id;
    await admin
      .from("crm_pipelines")
      .update({
        name: DEMO_PIPELINE_NAME,
        is_default: true,
        is_archived: false,
      } as never)
      .eq("id", pipelineId);
  } else {
    const { data: createdPipe, error: pipeErr } = await admin
      .from("crm_pipelines")
      .insert({
        organization_id: orgId,
        slug: DEMO_PIPELINE_SLUG,
        name: DEMO_PIPELINE_NAME,
        description: "Flujo comercial y clínico para pacientes de Clínica Sonrisa Bogotá",
        is_default: true,
        is_archived: false,
        position: 1,
      } as never)
      .select("id")
      .single();

    if (pipeErr || !createdPipe) {
      throw new Error(`Failed to create pipeline: ${pipeErr?.message}`);
    }
    pipelineId = (createdPipe as { id: string }).id;
  }

  // Ensure stages
  const stagesMap = new Map<string, { id: string; name: string; slug: string }>();

  for (const stageSpec of DEMO_STAGES_SPECS) {
    const { data: existingStage } = await admin
      .from("crm_stages")
      .select("id, name, slug")
      .eq("organization_id", orgId)
      .eq("pipeline_id", pipelineId)
      .eq("slug", stageSpec.slug)
      .maybeSingle();

    if (existingStage) {
      const stageRow = existingStage as { id: string; name: string; slug: string };
      await admin
        .from("crm_stages")
        .update({
          name: stageSpec.name,
          position: stageSpec.position,
          is_won: stageSpec.isWon ?? false,
          is_lost: stageSpec.isLost ?? false,
          is_archived: false,
        } as never)
        .eq("id", stageRow.id);

      stagesMap.set(stageSpec.slug, stageRow);
    } else {
      const { data: createdStage, error: stageErr } = await admin
        .from("crm_stages")
        .insert({
          organization_id: orgId,
          pipeline_id: pipelineId,
          slug: stageSpec.slug,
          name: stageSpec.name,
          position: stageSpec.position,
          is_won: stageSpec.isWon ?? false,
          is_lost: stageSpec.isLost ?? false,
          is_archived: false,
        } as never)
        .select("id, name, slug")
        .single();

      if (stageErr || !createdStage) {
        throw new Error(`Failed to create stage ${stageSpec.name}: ${stageErr?.message}`);
      }

      const stageRow = createdStage as { id: string; name: string; slug: string };
      stagesMap.set(stageSpec.slug, stageRow);
    }
  }

  return { pipelineId, stages: stagesMap };
}
