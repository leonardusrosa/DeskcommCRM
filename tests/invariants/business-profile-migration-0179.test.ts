/**
 * INVARIANTE: Migração retrocompatível do perfil de negócio (migration 0179)
 *
 * Contra o Postgres real nascido do baseline.sql:
 *  1. Migra o_que_faz do onboarding para settings.business_profile.description quando ausente.
 *  2. NÃO sobrescreve business_profile.description quando já existente.
 *  3. Preserva todas as chaves paralelas do settings (ex: lost_reasons_extra, branding).
 *  4. É idempotente.
 */
import { describe, expect, it } from "vitest";
import { sql } from "./psql-transporte";

const ORG_A = "aaaaaaaa-1111-4000-8000-000000000001";
const ORG_B = "bbbbbbbb-2222-4000-8000-000000000002";
const ORG_C = "cccccccc-3333-4000-8000-000000000003";

function semearAmbiente(): void {
  sql(`
    delete from public.organizations where id in ('${ORG_A}', '${ORG_B}', '${ORG_C}');

    -- Org A: tem o_que_faz no onboarding e settings sem business_profile
    insert into public.organizations (
      id, slug, legal_name, display_name, settings, onboarding_state
    ) values (
      '${ORG_A}', 'org-mig-a', 'Org Mig A', 'Org A',
      '{"lost_reasons_extra": ["preço", "concorrente"], "branding": {"app_name": "Portal A"}}'::jsonb,
      '{"welcome": {"display_name": "Org A", "o_que_faz": "Automações e landing pages", "timezone": "UTC"}}'::jsonb
    );

    -- Org B: já tem business_profile.description preenchido e onboarding com outro valor
    insert into public.organizations (
      id, slug, legal_name, display_name, settings, onboarding_state
    ) values (
      '${ORG_B}', 'org-mig-b', 'Org Mig B', 'Org B',
      '{"business_profile": {"description": "Consultoria avançada de software"}, "branding": {"app_name": "Portal B"}}'::jsonb,
      '{"welcome": {"display_name": "Org B", "o_que_faz": "Texto antigo do onboarding", "timezone": "America/Sao_Paulo"}}'::jsonb
    );

    -- Org C: onboarding sem o_que_faz
    insert into public.organizations (
      id, slug, legal_name, display_name, settings, onboarding_state
    ) values (
      '${ORG_C}', 'org-mig-c', 'Org Mig C', 'Org C',
      '{"lost_reasons_extra": ["outro"]}'::jsonb,
      '{"welcome": {"display_name": "Org C", "timezone": "UTC"}}'::jsonb
    );
  `);
}

describe("migration 0179 — migração de perfil de negócio do onboarding para settings", () => {
  it("A. migra o_que_faz para settings.business_profile.description e preserva chaves paralelas", () => {
    semearAmbiente();

    // Aplica o comando exato da migration 0179
    sql(`
      update public.organizations
      set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'business_profile',
        coalesce(settings->'business_profile', '{}'::jsonb) || jsonb_build_object(
          'description', trim(onboarding_state->'welcome'->>'o_que_faz')
        )
      )
      where (onboarding_state->'welcome'->>'o_que_faz') is not null
        and trim(onboarding_state->'welcome'->>'o_que_faz') <> ''
        and (
          settings->'business_profile'->>'description' is null
          or trim(settings->'business_profile'->>'description') = ''
        );
    `);

    // Verifica Org A: description foi preenchido com o valor do onboarding
    const descA = sql(`
      select settings->'business_profile'->>'description' from public.organizations where id = '${ORG_A}';
    `);
    expect(descA).toBe("Automações e landing pages");

    // Verifica Org A: chaves paralelas de settings foram preservadas intactas
    const brandingAppA = sql(`
      select settings->'branding'->>'app_name' from public.organizations where id = '${ORG_A}';
    `);
    expect(brandingAppA).toBe("Portal A");

    const reasonsCountA = sql(`
      select jsonb_array_length(settings->'lost_reasons_extra')::text from public.organizations where id = '${ORG_A}';
    `);
    expect(reasonsCountA).toBe("2");
  });

  it("B. NÃO sobrescreve business_profile.description quando já existe", () => {
    semearAmbiente();

    sql(`
      update public.organizations
      set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'business_profile',
        coalesce(settings->'business_profile', '{}'::jsonb) || jsonb_build_object(
          'description', trim(onboarding_state->'welcome'->>'o_que_faz')
        )
      )
      where (onboarding_state->'welcome'->>'o_que_faz') is not null
        and trim(onboarding_state->'welcome'->>'o_que_faz') <> ''
        and (
          settings->'business_profile'->>'description' is null
          or trim(settings->'business_profile'->>'description') = ''
        );
    `);

    const descB = sql(`
      select settings->'business_profile'->>'description' from public.organizations where id = '${ORG_B}';
    `);
    expect(descB).toBe("Consultoria avançada de software");

    const brandingAppB = sql(`
      select settings->'branding'->>'app_name' from public.organizations where id = '${ORG_B}';
    `);
    expect(brandingAppB).toBe("Portal B");
  });

  it("C. é idempotente — reexecutar não causa alterações nem corrupção", () => {
    semearAmbiente();

    const migSql = `
      update public.organizations
      set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
        'business_profile',
        coalesce(settings->'business_profile', '{}'::jsonb) || jsonb_build_object(
          'description', trim(onboarding_state->'welcome'->>'o_que_faz')
        )
      )
      where (onboarding_state->'welcome'->>'o_que_faz') is not null
        and trim(onboarding_state->'welcome'->>'o_que_faz') <> ''
        and (
          settings->'business_profile'->>'description' is null
          or trim(settings->'business_profile'->>'description') = ''
        );
    `;

    sql(migSql);
    sql(migSql);

    const descA = sql(`
      select settings->'business_profile'->>'description' from public.organizations where id = '${ORG_A}';
    `);
    expect(descA).toBe("Automações e landing pages");

    const descC = sql(`
      select coalesce(settings->'business_profile'->>'description', 'null') from public.organizations where id = '${ORG_C}';
    `);
    expect(descC).toBe("null");
  });
});