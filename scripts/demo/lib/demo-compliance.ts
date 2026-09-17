/**
 * scripts/demo/lib/demo-compliance.ts
 *
 * Demo Platform Compliance & Privacy Engine.
 * Handles data retention policies, PII anonymization, and GDPR erasure.
 * Strictly isolated: operates exclusively on local demo storage (.demo/).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import {
  listDemoLeads,
  DEFAULT_DEMO_LEADS_FILE,
  type DemoLead,
} from "./demo-leads";
import { recordDemoAudit } from "./demo-audit";

export type ComplianceActionType =
  | "purge_retention"
  | "anonymize_pii"
  | "gdpr_erasure";

export interface ComplianceRecord {
  id: string;
  action: ComplianceActionType;
  targetId: string;
  tenantId?: string;
  details: string;
  purgedItemsCount?: number;
  executedAt: string;
}

export const DEFAULT_COMPLIANCE_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_compliance.json",
);

function assertSafety(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Compliance operations on demo store are strictly forbidden in production.");
  }
}

/**
 * Lists all compliance history records.
 */
export function listComplianceRecords(
  customFilePath = DEFAULT_COMPLIANCE_FILE,
): ComplianceRecord[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const raw = fs.readFileSync(customFilePath, "utf-8");
    return JSON.parse(raw) as ComplianceRecord[];
  } catch {
    return [];
  }
}

/**
 * Records a compliance operation.
 */
export function recordComplianceAction(
  record: Omit<ComplianceRecord, "id" | "executedAt">,
  customFilePath = DEFAULT_COMPLIANCE_FILE,
): ComplianceRecord {
  const dir = path.dirname(customFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const fullRecord: ComplianceRecord = {
    ...record,
    id: crypto.randomUUID(),
    executedAt: new Date().toISOString(),
  };

  const existing = listComplianceRecords(customFilePath);
  existing.push(fullRecord);
  fs.writeFileSync(customFilePath, JSON.stringify(existing, null, 2), "utf-8");

  return fullRecord;
}

/**
 * Anonymizes PII of a demo lead (email, phone, name, company) while preserving
 * structural analytics metadata (country, vertical, status, timestamps).
 */
export function anonymizeDemoLead(
  idOrTenantId: string,
  options: {
    customLeadsFile?: string;
    customComplianceFile?: string;
    actorEmail?: string;
  } = {},
): DemoLead | null {
  assertSafety();
  const leadsFile = options.customLeadsFile || DEFAULT_DEMO_LEADS_FILE;
  if (!fs.existsSync(leadsFile)) return null;

  const leads = listDemoLeads({}, leadsFile);
  const index = leads.findIndex(
    (l) => l.id === idOrTenantId || l.demo_tenant_id === idOrTenantId,
  );

  if (index === -1) return null;

  const target = leads[index]!;
  const salt = crypto.createHash("sha256").update(target.id).digest("hex").slice(0, 8);

  const beforeSnapshot = {
    name: target.name,
    email: target.email,
    whatsapp: target.whatsapp,
    company: target.company,
  };

  const anonymized: DemoLead = {
    ...target,
    name: `Usuario Anónimo #${salt}`,
    email: `anonymized_${salt}@privacy.demo`,
    whatsapp: "+00000000000",
    company: `Organización Anónima #${salt}`,
    updated_at: new Date().toISOString(),
  };

  leads[index] = anonymized;
  fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2), "utf-8");

  recordComplianceAction(
    {
      action: "anonymize_pii",
      targetId: target.id,
      tenantId: target.demo_tenant_id,
      details: `PII for lead ${target.id} masked using SHA-256 hash digest.`,
    },
    options.customComplianceFile,
  );

  recordDemoAudit({
    tenantId: target.demo_tenant_id,
    actionType: "compliance_anonymize",
    actorEmail: options.actorEmail || "compliance@deskcomm.demo",
    description: `Anonymized PII for lead ${target.id}`,
    before: beforeSnapshot,
    after: { email: anonymized.email, name: anonymized.name },
  });

  return anonymized;
}

/**
 * Executes GDPR erasure: completely purges the lead record and records
 * a zero-PII certificate of deletion.
 */
export function gdprForgetDemoLead(
  idOrTenantId: string,
  options: {
    customLeadsFile?: string;
    customComplianceFile?: string;
    actorEmail?: string;
  } = {},
): boolean {
  assertSafety();
  const leadsFile = options.customLeadsFile || DEFAULT_DEMO_LEADS_FILE;
  if (!fs.existsSync(leadsFile)) return false;

  const leads = listDemoLeads({}, leadsFile);
  const target = leads.find(
    (l) => l.id === idOrTenantId || l.demo_tenant_id === idOrTenantId,
  );

  if (!target) return false;

  const remaining = leads.filter((l) => l.id !== target.id);
  fs.writeFileSync(leadsFile, JSON.stringify(remaining, null, 2), "utf-8");

  recordComplianceAction(
    {
      action: "gdpr_erasure",
      targetId: target.id,
      tenantId: target.demo_tenant_id,
      details: `GDPR deletion executed for lead ID ${target.id}. Personal records erased.`,
    },
    options.customComplianceFile,
  );

  recordDemoAudit({
    tenantId: target.demo_tenant_id,
    actionType: "compliance_gdpr_delete",
    actorEmail: options.actorEmail || "dpo@deskcomm.demo",
    description: `GDPR erasure executed for demo lead ${target.id}`,
  });

  return true;
}

/**
 * Purges demo leads older than retentionDays (default 30 days).
 */
export function purgeExpiredDemoRetention(
  retentionDays = 30,
  options: {
    customLeadsFile?: string;
    customComplianceFile?: string;
    nowDate?: Date;
  } = {},
): { purgedCount: number; remainingCount: number } {
  assertSafety();
  const leadsFile = options.customLeadsFile || DEFAULT_DEMO_LEADS_FILE;
  if (!fs.existsSync(leadsFile)) return { purgedCount: 0, remainingCount: 0 };

  const now = options.nowDate ? options.nowDate.getTime() : Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const cutoffTime = now - maxAgeMs;

  const leads = listDemoLeads({}, leadsFile);
  const remaining: DemoLead[] = [];
  let purgedCount = 0;

  for (const lead of leads) {
    const createdAtMs = new Date(lead.created_at).getTime();
    if (createdAtMs < cutoffTime) {
      purgedCount += 1;
    } else {
      remaining.push(lead);
    }
  }

  if (purgedCount > 0) {
    fs.writeFileSync(leadsFile, JSON.stringify(remaining, null, 2), "utf-8");

    recordComplianceAction(
      {
        action: "purge_retention",
        targetId: `retention_cutoff_${retentionDays}d`,
        details: `Purged ${purgedCount} expired demo leads exceeding ${retentionDays} days retention.`,
        purgedItemsCount: purgedCount,
      },
      options.customComplianceFile,
    );

    recordDemoAudit({
      tenantId: "system_compliance",
      actionType: "compliance_purge",
      actorEmail: "retention-cron@deskcomm.demo",
      description: `Purged ${purgedCount} records older than ${retentionDays} days.`,
      metadata: { retentionDays, purgedCount },
    });
  }

  return { purgedCount, remainingCount: remaining.length };
}
