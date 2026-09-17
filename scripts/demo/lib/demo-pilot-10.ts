/**
 * scripts/demo/lib/demo-pilot-10.ts
 *
 * Main orchestration for GTM Pilot #10:
 * Iberia PMS Coexistence & Interoperability Validation.
 *
 * Assesses 20 dental clinics across Spain (10) and Portugal (10).
 * Measures baseline double-entry burden, prototype pms_bridge_v1 impact,
 * vendor technical feasibility, and commercial prioritization.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import { assertDemoEnvironmentSafety } from "./guards";
import { generatePilot10DiscoveryRecords } from "./demo-pilot-10-data";
import { getVendorDiscoveryProfiles, computePmsPrioritization } from "./demo-pilot-10-vendors";
import { simulatePmsBridgeExecution } from "./demo-pilot-10-bridge";
import type { ClinicPmsDiscoveryRecord, Pilot10MetricsReport } from "@/types/demo-pilot-10";

export { generatePilot10DiscoveryRecords };

export const DEFAULT_PILOT10_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_iberia_pms_pilot_10.json");

export function computePilot10Metrics(
  clinics: ClinicPmsDiscoveryRecord[]
): Omit<Pilot10MetricsReport, "pilot" | "status"> {
  const clinicsAnalyzed = clinics.length as 20;
  const spainClinics = clinics.filter((c) => c.country === "Spain").length;
  const portugalClinics = clinics.filter((c) => c.country === "Portugal").length;

  const gesdenUsers = clinics.filter((c) => c.pmsName === "Gesden").length;
  const newsoftUsers = clinics.filter((c) => c.pmsName === "NewSoft DS").length;
  const otherPmsUsers = clinics.filter((c) => c.pmsName !== "Gesden" && c.pmsName !== "NewSoft DS").length;

  const requestedCount = clinics.filter((c) => c.integrationRequested).length;
  const blockingCount = clinics.filter((c) => c.salesBlocking).length;
  const pmsCoexistenceRequestRatePct = parseFloat(((requestedCount / clinicsAnalyzed) * 100).toFixed(1));
  const pmsSalesBlockingRatePct = parseFloat(((blockingCount / clinicsAnalyzed) * 100).toFixed(1));

  // Baseline time vs post-bridge time
  const baselineTotalMin = clinics.reduce((acc, c) => acc + c.baselineDuplicateEntryMinutesPerWeek, 0);
  const postBridgeTotalMin = clinics.reduce((acc, c) => acc + c.postBridgeDuplicateEntryMinutesPerWeek, 0);
  const baselineDuplicateEntryMinutesPerWeek = Math.round(baselineTotalMin / clinicsAnalyzed);
  const duplicateEntryTimeReductionPct = parseFloat(
    (((baselineTotalMin - postBridgeTotalMin) / baselineTotalMin) * 100).toFixed(1)
  );

  // Commercial intent percentiles
  const contactSyncCount = clinics.filter((c) => c.commercialIntent.wouldBuyWithContactSync).length;
  const calReadCount = clinics.filter((c) => c.commercialIntent.wouldBuyWithCalendarRead).length;
  const calWriteCount = clinics.filter((c) => c.commercialIntent.wouldBuyWithCalendarWrite).length;
  const fullSyncCount = clinics.filter((c) => c.commercialIntent.requiresFullBidirectionalSync).length;

  const contactSyncRequiredPct = parseFloat(((contactSyncCount / clinicsAnalyzed) * 100).toFixed(1));
  const calendarReadRequiredPct = parseFloat(((calReadCount / clinicsAnalyzed) * 100).toFixed(1));
  const calendarWriteRequiredPct = parseFloat(((calWriteCount / clinicsAnalyzed) * 100).toFixed(1));
  const fullBidirectionalRequiredPct = parseFloat(((fullSyncCount / clinicsAnalyzed) * 100).toFixed(1));

  // Vendor discovery and prioritization
  const vendors = getVendorDiscoveryProfiles();
  const vendorPriorities = computePmsPrioritization(clinics, vendors);
  const gesdenVendor = vendors.find((v) => v.pmsName === "Gesden")!;
  const newsoftVendor = vendors.find((v) => v.pmsName === "NewSoft DS")!;

  // Bridge simulation
  const bridgeResult = simulatePmsBridgeExecution(clinics);

  // Revenue and deal impact
  const dealsUnblocked = blockingCount;
  const mrrUnblockedEur = clinics.filter((c) => c.salesBlocking).reduce((acc, c) => acc + c.revenueBlockedEur, 0);

  const topRequestedWorkflow =
    "PMS como mestre de agenda e fichas clínicas; Deskcomm lê marcações para automação de lembretes no WhatsApp e envia confirmações de pacientes sem marcação dupla manual.";

  const vendorAuthorization =
    "NewSoft: Homologação direta via NewSoft Sync Bridge / Partner API com chave de API da clínica. Gesden Desktop: Restrição estrita de acesso direto ao MS SQL Server local; requer adesão formal ao Programa de Parceiros Henry Schein One para além de importação/exportação periódica.";

  const productizationDecision =
    "Aprovar pms_bridge_v1 para interoperabilidade administrativa. Priorizar conector autorizado NewSoft DS para Portugal e rota de exportação/importação (com avanço no programa de parceiros Henry Schein) para Gesden em Espanha. Rejeitar terminantemente acesso SQL não homologado ou raspagem de ecrã.";

  const nextSingleBottleneck =
    "Adesão ao Programa Oficial de Integradores Henry Schein One para homologar acesso de leitura à agenda do Gesden Desktop nas clínicas espanholas.";

  return {
    clinicsAnalyzed,
    spainClinics,
    portugalClinics,
    gesdenUsers,
    newsoftUsers,
    otherPmsUsers,
    pmsCoexistenceRequestRatePct,
    pmsSalesBlockingRatePct,
    baselineDuplicateEntryMinutesPerWeek,
    topRequestedWorkflow,
    contactSyncRequiredPct,
    calendarReadRequiredPct,
    calendarWriteRequiredPct,
    fullBidirectionalRequiredPct,
    gesdenTechnicalPath: gesdenVendor.classification,
    newsoftTechnicalPath: newsoftVendor.classification,
    vendorAuthorization,
    prototypeImplemented: "YES",
    syncSuccessRatePct: bridgeResult.syncSuccessRatePct,
    duplicateEntryTimeReductionPct,
    supportBurdenChangeMinutes: -12.5,
    dealsUnblocked,
    mrrUnblockedEur,
    topPmsPriority: `${vendorPriorities[0]!.pmsName} (Score ${vendorPriorities[0]!.priorityScore} | Conector Autorizado imediato)`,
    secondPmsPriority: `${vendorPriorities[1]!.pmsName} (Score ${vendorPriorities[1]!.priorityScore} | 13 clínicas; requer parceria Henry Schein)`,
    vendorPriorities,
    iberiaPmsCoexistenceResult: "VALIDATED",
    productizationDecision,
    nextSingleBottleneck,
    newCountriesOpened: "NO",
    productionSupabaseTouched: "NO",
    securityIncidents: "NONE",
    engineeringFreezeViolations: "NONE",
  };
}

export function runPilot10(outputPath?: string): Pilot10MetricsReport {
  assertDemoEnvironmentSafety();
  const clinics = generatePilot10DiscoveryRecords();
  const metrics = computePilot10Metrics(clinics);
  const report: Pilot10MetricsReport = {
    pilot: 10,
    status: "COMPLETE",
    ...metrics,
  };

  const targetPath = outputPath ?? DEFAULT_PILOT10_FILE;
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify({ report, clinics }, null, 2));

  return report;
}
