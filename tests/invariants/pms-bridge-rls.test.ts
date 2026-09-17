import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const container = process.env.TEST_DB_CONTAINER;
if (!container) throw new Error("TEST_DB_CONTAINER not set — run via pnpm test:db");

function sql(script: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"],
    { input: script, encoding: "utf8" },
  ).trim();
}

function countAs(userId: string, query: string): number {
  const out = sql(`
    set role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${userId}"}', false);
    ${query}
  `);
  const last = out.split("\n").at(-1);
  if (!last || !/^\d+$/.test(last)) throw new Error(`Unexpected psql output: ${out}`);
  return Number(last);
}

function queryFailsAs(userId: string, query: string): boolean {
  try {
    countAs(userId, query);
    return false;
  } catch {
    return true;
  }
}

const ORG_A = "9f510000-0000-4000-8000-00000000000a";
const ORG_B = "9f510000-0000-4000-8000-00000000000b";
const ADMIN_A = "9f511111-0000-4000-8000-00000000000a";
const VIEWER_A = "9f511111-0000-4000-8000-00000000000c";
const ADMIN_B = "9f511111-0000-4000-8000-00000000000b";
const CONN_A = "9f512222-0000-4000-8000-00000000000a";
const CONN_B = "9f512222-0000-4000-8000-00000000000b";

beforeAll(() => {
  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260917180000_0182_pms_bridge_persistence.sql"),
    "utf8",
  );
  sql(migration);

  sql(`
    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'pms-admin-a@invariant.test'),
      ('${VIEWER_A}', 'pms-viewer-a@invariant.test'),
      ('${ADMIN_B}', 'pms-admin-b@invariant.test')
    on conflict (id) do nothing;

    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG_A}', 'pms-invariant-a', 'PMS Invariant A', 'PMS A'),
      ('${ORG_B}', 'pms-invariant-b', 'PMS Invariant B', 'PMS B')
    on conflict (id) do nothing;

    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${ADMIN_A}', '${ORG_A}', 'admin', now()),
      ('${VIEWER_A}', '${ORG_A}', 'viewer', now()),
      ('${ADMIN_B}', '${ORG_B}', 'admin', now())
    on conflict do nothing;

    insert into public.pms_connections
      (id, organization_id, provider, endpoint_url, last4, capabilities)
    values
      ('${CONN_A}', '${ORG_A}', 'newsoft_ds', 'https://bridge-a.test/', '1111', '{}'),
      ('${CONN_B}', '${ORG_B}', 'newsoft_ds', 'https://bridge-b.test/', '2222', '{}');

    insert into public.pms_connection_secrets
      (connection_id, organization_id, credential_ciphertext, credential_iv, credential_tag)
    values
      ('${CONN_A}', '${ORG_A}', 'cipher-a', 'iv-a', 'tag-a'),
      ('${CONN_B}', '${ORG_B}', 'cipher-b', 'iv-b', 'tag-b');

    insert into public.pms_external_mappings
      (organization_id, provider, entity_type, external_id, deskcomm_id, checksum)
    values
      ('${ORG_A}', 'newsoft_ds', 'contact', 'external-a', 'deskcomm-a', 'sum-a'),
      ('${ORG_B}', 'newsoft_ds', 'contact', 'external-b', 'deskcomm-b', 'sum-b');

    insert into public.pms_audit_events (organization_id, provider, action, metadata) values
      ('${ORG_A}', 'newsoft_ds', 'connection_created', '{}'),
      ('${ORG_B}', 'newsoft_ds', 'connection_created', '{}');
  `);
});

describe("PMS bridge — RLS and credential boundary", () => {
  it("tenant admin reads own connection and zero neighbor connections", () => {
    expect(countAs(ADMIN_A, `select count(*) from public.pms_connections where organization_id='${ORG_A}';`)).toBe(1);
    expect(countAs(ADMIN_A, `select count(*) from public.pms_connections where organization_id='${ORG_B}';`)).toBe(0);
    expect(countAs(ADMIN_B, `select count(*) from public.pms_connections where organization_id='${ORG_A}';`)).toBe(0);
  });

  it("viewer cannot read connection metadata and even admin cannot query secret storage", () => {
    expect(countAs(VIEWER_A, `select count(*) from public.pms_connections where organization_id='${ORG_A}';`)).toBe(0);
    expect(queryFailsAs(ADMIN_A, "select count(*) from public.pms_connection_secrets;")).toBe(true);
  });

  it("tenant members can read only mappings from their organization", () => {
    expect(countAs(VIEWER_A, `select count(*) from public.pms_external_mappings where organization_id='${ORG_A}';`)).toBe(1);
    expect(countAs(VIEWER_A, `select count(*) from public.pms_external_mappings where organization_id='${ORG_B}';`)).toBe(0);
  });

  it("audit rows are admin-only and tenant isolated", () => {
    expect(countAs(ADMIN_A, `select count(*) from public.pms_audit_events where organization_id='${ORG_A}';`)).toBe(1);
    expect(countAs(ADMIN_A, `select count(*) from public.pms_audit_events where organization_id='${ORG_B}';`)).toBe(0);
    expect(countAs(VIEWER_A, `select count(*) from public.pms_audit_events where organization_id='${ORG_A}';`)).toBe(0);
  });

  it("all PMS persistence tables have RLS enabled", () => {
    const enabled = sql(`
      select count(*) from pg_class
       where relnamespace = 'public'::regnamespace
         and relname in ('pms_connections','pms_connection_secrets','pms_external_mappings','pms_audit_events')
         and relrowsecurity;
    `);
    expect(Number(enabled)).toBe(4);
  });
});
