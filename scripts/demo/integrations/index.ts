/**
 * scripts/demo/integrations/index.ts
 *
 * CRM Integration Framework Dispatcher.
 * Multi-adapter dispatcher for HubSpot, Pipedrive, and Salesforce.
 * Enforces demo safety isolation, event-driven broadcasting, and fail-silent persistence.
 */

import fs from "node:fs";
import path from "node:path";
import { assertDemoEnvironmentSafety } from "../lib/guards";
import { DEFAULT_DEMO_DIR } from "../lib/demo-session";
import type { CRMProvider, CRMEventPayload, CRMSyncResult } from "./types";
import { syncToHubSpot } from "./hubspot";
import { syncToPipedrive } from "./pipedrive";
import { syncToSalesforce } from "./salesforce";

export * from "./types";
export { syncToHubSpot } from "./hubspot";
export { syncToPipedrive } from "./pipedrive";
export { syncToSalesforce } from "./salesforce";

export const DEFAULT_CRM_AUDIT_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "crm_sync_audit.json",
);

export async function dispatchCRMIntegration(
  event: CRMEventPayload,
  options: {
    providers?: CRMProvider[];
    customAuditFile?: string;
    customEnv?: Record<string, string | undefined>;
  } = {},
): Promise<Record<CRMProvider, CRMSyncResult>> {
  // Enforce safety guards: CRM integration must never execute against production
  assertDemoEnvironmentSafety(options.customEnv);

  const targets = options.providers ?? ["hubspot", "pipedrive", "salesforce"];
  const results: Partial<Record<CRMProvider, CRMSyncResult>> = {};

  const promises = targets.map(async (provider) => {
    switch (provider) {
      case "hubspot":
        results.hubspot = await syncToHubSpot(event);
        break;
      case "pipedrive":
        results.pipedrive = await syncToPipedrive(event);
        break;
      case "salesforce":
        results.salesforce = await syncToSalesforce(event);
        break;
    }
  });

  await Promise.all(promises);

  // Persist audit trail fail-silently
  persistCRMAudit(event, results as Record<CRMProvider, CRMSyncResult>, options.customAuditFile);

  return results as Record<CRMProvider, CRMSyncResult>;
}

function persistCRMAudit(
  event: CRMEventPayload,
  results: Record<CRMProvider, CRMSyncResult>,
  targetFile = DEFAULT_CRM_AUDIT_FILE,
): void {
  try {
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let auditList: Array<{
      event: CRMEventPayload;
      results: Record<CRMProvider, CRMSyncResult>;
      dispatchedAt: string;
    }> = [];
    if (fs.existsSync(targetFile)) {
      try {
        auditList = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
      } catch {
        auditList = [];
      }
    }
    auditList.push({
      event,
      results,
      dispatchedAt: new Date().toISOString(),
    });
    fs.writeFileSync(targetFile, JSON.stringify(auditList, null, 2), "utf-8");
  } catch {
    // Fail silent: never crash demo on audit write failure
  }
}
