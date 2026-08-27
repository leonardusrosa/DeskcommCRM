/**
 * INVARIANTE: precisão monetária e suporte a NULL em ai_agent_runs.cost_cents (0177)
 *
 * Contra o Postgres real nascido do baseline.sql:
 *  1. explicit cost_cents = NULL é aceito pelo banco (DROP NOT NULL).
 *  2. cost_cents sub-centavo com alta precisão (ex: 0.000035) persiste sem truncamento na 4ª casa decimal.
 *  3. omissão de cost_cents aplica o default 0.
 *  4. update para cost_cents = null é persistido com fidelidade.
 */
import { describe, expect, it } from "vitest";
import { sql } from "./psql-transporte";

const ORG = "11111111-1111-4000-8000-000000000001";
const AGENT = "22222222-2222-4000-8000-000000000002";
const SESSION = "33333333-3333-4000-8000-000000000003";
const VERSION = "44444444-4444-4000-8000-000000000004";

function semearAmbiente(): void {
  sql(`
    delete from public.ai_agent_runs where organization_id = '${ORG}';
    delete from public.ai_agent_versions where id = '${VERSION}';
    delete from public.channel_sessions where id = '${SESSION}';
    delete from public.ai_agents where id = '${AGENT}';
    delete from public.organizations where id = '${ORG}';

    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG}', 'org-runs-cost', 'Org Runs Cost Test', 'Runs Cost Test');

    insert into public.channel_sessions (id, organization_id, waha_session_name, status, webhook_secret_encrypted)
      values ('${SESSION}', '${ORG}', 'sessao-runs-cost', 'WORKING', '\\x00'::bytea);

    insert into public.ai_agents (id, organization_id, name, system_prompt) values
      ('${AGENT}', '${ORG}', 'Agente Cost Test', 'Prompt do agente');

    insert into public.ai_agent_versions (
      id, organization_id, agent_id, version_number, system_prompt, provider, model, channel_session_id
    ) values (
      '${VERSION}', '${ORG}', '${AGENT}', 1, 'Prompt de teste', 'anthropic', 'claude-sonnet-4-6', '${SESSION}'
    );
  `);
}

describe("ai_agent_runs.cost_cents - precisão e nullability (migration 0177)", () => {
  it("A. aceita cost_cents = NULL explicitamente", () => {
    semearAmbiente();
    const RUN_ID = "55555555-5555-4000-8000-000000000005";

    sql(`
      insert into public.ai_agent_runs (id, organization_id, agent_id, agent_version_id, status, cost_cents)
      values ('${RUN_ID}', '${ORG}', '${AGENT}', '${VERSION}', 'running', null);
    `);

    const out = sql(`select cost_cents is null from public.ai_agent_runs where id = '${RUN_ID}';`).trim();
    expect(out).toBe("t");
  });

  it("B. persiste micro-custo 0.000035 sem truncar casas decimais", () => {
    semearAmbiente();
    const RUN_ID = "66666666-6666-4000-8000-000000000006";

    sql(`
      insert into public.ai_agent_runs (id, organization_id, agent_id, agent_version_id, status, cost_cents)
      values ('${RUN_ID}', '${ORG}', '${AGENT}', '${VERSION}', 'running', 0.000035);
    `);

    const out = sql(`select cost_cents::text from public.ai_agent_runs where id = '${RUN_ID}';`).trim();
    expect(out).toBe("0.000035");
  });

  it("C. omissão de cost_cents aplica o default 0", () => {
    semearAmbiente();
    const RUN_ID = "77777777-7777-4000-8000-000000000007";

    sql(`
      insert into public.ai_agent_runs (id, organization_id, agent_id, agent_version_id, status)
      values ('${RUN_ID}', '${ORG}', '${AGENT}', '${VERSION}', 'running');
    `);

    const out = sql(`select cost_cents::text from public.ai_agent_runs where id = '${RUN_ID}';`).trim();
    expect(out).toBe("0");
  });

  it("D. update de cost_cents para NULL persiste no banco de dados", () => {
    semearAmbiente();
    const RUN_ID = "88888888-8888-4000-8000-000000000008";

    sql(`
      insert into public.ai_agent_runs (id, organization_id, agent_id, agent_version_id, status, cost_cents)
      values ('${RUN_ID}', '${ORG}', '${AGENT}', '${VERSION}', 'running', 10);
    `);

    sql(`
      update public.ai_agent_runs
      set cost_cents = null, status = 'completed'
      where id = '${RUN_ID}' and organization_id = '${ORG}';
    `);

    const out = sql(`select cost_cents is null from public.ai_agent_runs where id = '${RUN_ID}';`).trim();
    expect(out).toBe("t");
  });
});