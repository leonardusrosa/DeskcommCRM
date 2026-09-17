/**
 * types/demo-pilot-10.ts
 *
 * Type definitions for GTM Pilot #10:
 * Iberia PMS Coexistence & Interoperability Validation.
 *
 * Analyzes 20 dental clinics across Spain (10) and Portugal (10)
 * using incumbent PMS solutions (Gesden, NewSoft DS, etc.) to validate
 * administrative interoperability (pms_bridge_v1) without clinical data.
 */

export type PmsName =
  | "Gesden"
  | "NewSoft DS"
  | "Infomed Dentool"
  | "ClinicWeb"
  | "Other";

export type DeploymentType = "desktop_local" | "cloud";

export type SourceOfTruthModel =
  | "model_a_pms_master"
  | "model_b_deskcomm_master"
  | "model_c_readonly_coexistence";

export type ConflictState =
  | "external_newer"
  | "deskcomm_newer"
  | "ambiguous"
  | "deleted_external"
  | "deleted_deskcomm";

export type SyncStatus = "synced" | "pending" | "conflict" | "failed";

export type VendorTechnicalPath =
  | "AUTHORIZED API"
  | "AUTHORIZED CONNECTOR"
  | "EXPORT/IMPORT ONLY"
  | "UNSUPPORTED"
  | "UNKNOWN";

export type IberiaCoexistenceResult =
  | "VALIDATED"
  | "PARTIALLY VALIDATED"
  | "NOT VALIDATED"
  | "INCONCLUSIVE";

export interface CommercialIntent {
  wouldBuyWithoutIntegration: boolean;
  wouldBuyWithContactSync: boolean;
  wouldBuyWithCalendarRead: boolean;
  wouldBuyWithCalendarWrite: boolean;
  requiresFullBidirectionalSync: boolean;
}

export interface ClinicPmsDiscoveryRecord {
  id: string;
  clinicName: string;
  country: "Spain" | "Portugal";
  city: string;
  pmsName: PmsName;
  pmsVersion: string;
  deployment: DeploymentType;
  sourceOfTruthPatientIdentity: "PMS" | "Deskcomm";
  sourceOfTruthAppointments: "PMS" | "Deskcomm";
  sourceOfTruthClinicalRecord: "PMS";
  sourceOfTruthBilling: "PMS";
  receptionUsersCount: number;
  appointmentsPerWeek: number;
  duplicateEntryWorkflow: string;
  baselineDuplicateEntryMinutesPerWeek: number;
  postBridgeDuplicateEntryMinutesPerWeek: number;
  integrationRequested: boolean;
  salesBlocking: boolean;
  exactRequestedWorkflow: string;
  rawClinicWording: string;
  revenueBlockedEur: number;
  churnRisk: "low" | "medium" | "high";
  commercialIntent: CommercialIntent;
}

export interface PmsVendorDiscovery {
  pmsName: PmsName;
  vendorName: string;
  officialPublicApi: boolean;
  privatePartnerApi: boolean;
  approvedIntegrationProgram: boolean;
  supportedExport: string;
  supportedImport: string;
  calendarExport: boolean;
  contactExport: boolean;
  webhookSupport: boolean;
  localConnectorSupport: boolean;
  databaseAccessPolicy: string;
  licensingRestrictions: string;
  evidenceSource: string;
  classification: VendorTechnicalPath;
}

export interface ExternalContact {
  externalId: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  syncStatus: SyncStatus;
  lastSyncedAt: string;
  checksum: string;
}

export interface ExternalAppointment {
  externalId: string;
  tenantId: string;
  patientExternalId: string;
  start: string;
  end: string;
  provider: string;
  status: string;
  appointmentLabel: string;
  syncStatus: SyncStatus;
  lastSyncedAt: string;
  checksum: string;
}

export interface PmsBridgeV1Result {
  contactsSynced: number;
  appointmentsSynced: number;
  syncSuccessRatePct: number;
  syncErrorRatePct: number;
  conflictsDetected: number;
  conflictsResolved: number;
  idempotencyVerified: boolean;
  nonClinicalGuardPassed: boolean;
  minutesSavedPerClinicPerWeek: number;
}

export interface PmsPriorityScore {
  pmsName: PmsName;
  recurringDemand: number;
  blockedMrrEur: number;
  technicalFeasibilityScore: number;
  priorityScore: number;
  rank: number;
  evidenceSummary: string;
}

export interface Pilot10MetricsReport {
  pilot: 10;
  status: "COMPLETE" | "PARTIAL" | "FAIL";
  clinicsAnalyzed: 20;
  spainClinics: 10;
  portugalClinics: 10;
  gesdenUsers: number;
  newsoftUsers: number;
  otherPmsUsers: number;
  pmsCoexistenceRequestRatePct: number;
  pmsSalesBlockingRatePct: number;
  baselineDuplicateEntryMinutesPerWeek: number;
  topRequestedWorkflow: string;
  contactSyncRequiredPct: number;
  calendarReadRequiredPct: number;
  calendarWriteRequiredPct: number;
  fullBidirectionalRequiredPct: number;
  gesdenTechnicalPath: VendorTechnicalPath;
  newsoftTechnicalPath: VendorTechnicalPath;
  vendorAuthorization: string;
  prototypeImplemented: "YES" | "NO";
  syncSuccessRatePct: number;
  duplicateEntryTimeReductionPct: number;
  supportBurdenChangeMinutes: number;
  dealsUnblocked: number;
  mrrUnblockedEur: number;
  topPmsPriority: string;
  secondPmsPriority: string;
  vendorPriorities: PmsPriorityScore[];
  iberiaPmsCoexistenceResult: IberiaCoexistenceResult;
  productizationDecision: string;
  nextSingleBottleneck: string;
  newCountriesOpened: "NO";
  productionSupabaseTouched: "NO";
  securityIncidents: "NONE";
  engineeringFreezeViolations: "NONE";
}
