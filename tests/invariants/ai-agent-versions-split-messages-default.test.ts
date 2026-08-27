/**
 * INVARIANTE: split_messages default true em ai_agent_versions (migration 0178)
 *
 * Contra o Postgres real nascido do baseline.sql:
 *  1. INSERT sem especificar split_messages aplica DEFAULT true.
 *  2. INSERT com split_messages = false persiste explicitamente false.
 *  3. Registros históricos criados com split_messages = false continuam false.
 */
import { describe, expect, it } from "vitest";
import { sql } from "./psql-transporte";

const ORG = "55555555-5555-4000-8000-000000000001";
const AGENT = "66666666-6666-4000-8000-000000000002";
const SESSION = "77777777-7777-4000-8000-000000000003";
const V1 = "88888888-8888-4000-8000-000000000001";
const V2 = "88888888-8888-4000-8000-000000000002";
const V3 = "88888888-8888-4000-8000-000000000003";

function semearAmbiente(): void {
  sql(`
    delete from public.ai_agent_runs where organization_id = '${ORG}';
    delete from public.ai_agent_versions where organization_id = '${ORG}';
    delete from public.channel_sessions where id = '${SESSION}';
    delete from public.ai_agents where id = '${AGENT}';
    delete from public.organizations where id = '${ORG}';

    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG}', 'org-split-msg-test', 'Org Split Msg Test', 'Split Msg Test');

    insert into public.channel_sessions (id, organization_id, waha_session_name, status, webhook_secret_encrypted)
      values ('${SESSION}', '${ORG}', 'sessao-split-msg', 'WORKING', '\\x00'::bytea);

    insert into public.ai_agents (id, organization_id, name, system_prompt) values
      ('${AGENT}', '${ORG}', 'Agente Split Test', 'Prompt do agente');
  `);
}

describe("ai_agent_versions.split_messages default true (migration 0178)", () => {
  it("A. insert sem especificar split_messages recebe true pelo default do banco", () => {
    semearAmbiente();

    sql(`
      insert into public.ai_agent_versions (
        id, organization_id, agent_id, version_number, system_prompt, provider, model, channel_session_id
      ) values (
        '${V1}', '${ORG}', '${AGENT}', 1, 'Prompt teste default', 'anthropic', 'claude-sonnet-4-6', '${SESSION}'
      );
    `);

    const out = sql(`
      select split_messages::text from public.ai_agent_versions where id = '${V1}';
    `);

    expect(out).toBe("true");
  });

  it("B. insert com split_messages = false persiste explicitamente false", () => {
    semearAmbiente();

    sql(`
      insert into public.ai_agent_versions (
        id, organization_id, agent_id, version_number, system_prompt, provider, model, channel_session_id, split_messages
      ) values (
        '${V2}', '${ORG}', '${AGENT}', 2, 'Prompt teste false', 'anthropic', 'claude-sonnet-4-6', '${SESSION}', false
      );
    `);

    const out = sql(`
      select split_messages::text from public.ai_agent_versions where id = '${V2}';
    `);

    expect(out).toBe("false");
  });

  it("C. linha preexistente com split_messages = false permanece false", () => {
    semearAmbiente();

    sql(`
      insert into public.ai_agent_versions (
        id, organization_id, agent_id, version_number, system_prompt, provider, model, channel_session_id, split_messages
      ) values (
        '${V3}', '${ORG}', '${AGENT}', 3, 'Prompt histórico false', 'anthropic', 'claude-sonnet-4-6', '${SESSION}', false
      );
    `);

    // Simula aplicação idempotente do alter column default
    sql(`
      ALTER TABLE public.ai_agent_versions
        ALTER COLUMN split_messages SET DEFAULT true;
    `);

    const out = sql(`
      select split_messages::text from public.ai_agent_versions where id = '${V3}';
    `);

    expect(out).toBe("false");
  });
});