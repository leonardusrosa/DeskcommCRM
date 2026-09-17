/**
 * tests/unit/demo-compliance-territories.test.ts
 *
 * Unit tests for Enterprise Territories Management and Compliance & Privacy Layer:
 *   - Territory resolution and rep assignment
 *   - Retention purging
 *   - Lead PII anonymization
 *   - GDPR right to erasure
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-compliance-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function tmp(name: string) {
  return path.join(tmpDir, name);
}

// ─── 1. Territory Management ─────────────────────────────────────────────────

describe("Territories Engine (scripts/demo/lib/demo-territories)", () => {
  it("resolves correct regional territory and currency for countries", async () => {
    const { resolveTerritory, assignTerritoryRep } = await import(
      "../../scripts/demo/lib/demo-territories"
    );

    const latam = resolveTerritory("CO");
    expect(latam.region).toBe("LATAM");
    expect(latam.defaultCurrency).toBe("COP");

    const emea = resolveTerritory("ES");
    expect(emea.region).toBe("EMEA");
    expect(emea.defaultCurrency).toBe("EUR");

    const br = resolveTerritory("BR");
    expect(br.defaultCurrency).toBe("BRL");

    const rep = assignTerritoryRep("CO");
    expect(rep).toBeDefined();
    expect(rep.email).toContain("@");
  });
});

// ─── 2. Compliance & Privacy Layer ───────────────────────────────────────────

describe("Compliance Engine (scripts/demo/lib/demo-compliance)", () => {
  it("anonymizes lead PII while preserving statistical metadata", async () => {
    const { anonymizeDemoLead } = await import(
      "../../scripts/demo/lib/demo-compliance"
    );
    const leadsFile = tmp("leads_anon.json");
    const compFile = tmp("comp_anon.json");

    const testLead = {
      id: "lead_anon_1",
      name: "Dra. Sofía Real",
      company: "Clínica Confidencial",
      country: "CO",
      vertical: "dental-clinic",
      email: "sofia.real@hospital.com",
      whatsapp: "+573001234567",
      demo_tenant_id: "t_anon_1",
      status: "activated",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    fs.writeFileSync(leadsFile, JSON.stringify([testLead], null, 2), "utf-8");

    const anon = anonymizeDemoLead("lead_anon_1", {
      customLeadsFile: leadsFile,
      customComplianceFile: compFile,
    });

    expect(anon).not.toBeNull();
    expect(anon?.name).toContain("Usuario Anónimo");
    expect(anon?.email).toContain("@privacy.demo");
    expect(anon?.whatsapp).toBe("+00000000000");
    expect(anon?.country).toBe("CO");
    expect(anon?.vertical).toBe("dental-clinic");
  });

  it("erases lead completely under GDPR request", async () => {
    const { gdprForgetDemoLead } = await import(
      "../../scripts/demo/lib/demo-compliance"
    );
    const leadsFile = tmp("leads_gdpr.json");
    const compFile = tmp("comp_gdpr.json");

    const testLead = {
      id: "lead_gdpr_del",
      name: "Juan Borrar",
      company: "Eliminar SA",
      country: "ES",
      vertical: "dental-clinic",
      email: "juan@borrame.es",
      whatsapp: "+34600000000",
      demo_tenant_id: "t_gdpr_del",
      status: "requested",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    fs.writeFileSync(leadsFile, JSON.stringify([testLead], null, 2), "utf-8");

    const erased = gdprForgetDemoLead("lead_gdpr_del", {
      customLeadsFile: leadsFile,
      customComplianceFile: compFile,
    });

    expect(erased).toBe(true);
    const after = JSON.parse(fs.readFileSync(leadsFile, "utf-8"));
    expect(after.length).toBe(0);
  });

  it("purges expired leads exceeding retention limit", async () => {
    const { purgeExpiredDemoRetention } = await import(
      "../../scripts/demo/lib/demo-compliance"
    );
    const leadsFile = tmp("leads_retention.json");
    const compFile = tmp("comp_retention.json");

    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const freshDate = new Date().toISOString();

    const leads = [
      {
        id: "lead_old",
        name: "Antiguo Lead",
        company: "Vieja",
        country: "BR",
        vertical: "dental-clinic",
        email: "old@demo.br",
        whatsapp: "+551199999999",
        demo_tenant_id: "t_old",
        status: "lost",
        created_at: oldDate,
        updated_at: oldDate,
      },
      {
        id: "lead_fresh",
        name: "Nuevo Lead",
        company: "Nueva",
        country: "BR",
        vertical: "dental-clinic",
        email: "fresh@demo.br",
        whatsapp: "+551199999998",
        demo_tenant_id: "t_fresh",
        status: "activated",
        created_at: freshDate,
        updated_at: freshDate,
      },
    ];

    fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2), "utf-8");

    const result = purgeExpiredDemoRetention(30, {
      customLeadsFile: leadsFile,
      customComplianceFile: compFile,
    });

    expect(result.purgedCount).toBe(1);
    expect(result.remainingCount).toBe(1);

    const after = JSON.parse(fs.readFileSync(leadsFile, "utf-8"));
    expect(after[0].id).toBe("lead_fresh");
  });
});
