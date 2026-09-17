/**
 * types/demo-pilot-11.ts
 *
 * Type definitions for GTM Pilot #11:
 * PMS Bridge Productionization & Vendor Certification.
 *
 * Implements Track A (NewSoft DS production connector) and
 * Track B (Gesden vendor certification / interim export-import),
 * mapping entities, capabilities, idempotency, and dual-dimension prioritization.
 */

export type PmsProviderName = "newsoft_ds" | "gesden" | "infomed_dentool";

export type SyncLifecycleState = "pending" | "synced" | "conflict" | "failed" | "disabled";

export type SyncConflictType =
  | "external_newer"
  | "deskcomm_newer"
  | "ambiguous"
  | "external_deleted"
  | "deskcomm_deleted";

export interface PmsCapabilityModel {
  contactsRead: boolean;
  appointmentsRead: boolean;
  appointmentsCreate: boolean;
  appointmentsUpdate: boolean;
  appointmentsCancel: boolean;
  realtimeWebhooks: boolean;
  incrementalSync: boolean;
}

export interface PmsExternalMapping {
  id: string;
  tenantId: string;
  provider: PmsProviderName;
  entityType: "contact" | "appointment";
  externalId: string;
  deskcommId: string;
  externalVersion: string;
  checksum: string;
  lastExternalUpdateAt: string;
  lastSyncedAt: string;
  syncStatus: SyncLifecycleState;
  conflictType?: SyncConflictType;
}

export interface NewSoftTechnicalContract {
  patientContactRead: "SUPPORTED";
  appointmentRead: "SUPPORTED";
  appointmentCreate: "SUPPORTED";
  appointmentUpdate: "SUPPORTED";
  appointmentCancel: "SUPPORTED";
  webhooks: "SUPPORTED";
  incrementalSync: "SUPPORTED";
}

export interface GesdenVendorDossier {
  vendorName: string;
  targetProduct: "Gesden G5 Desktop";
  partnerProgramAvailable: boolean;
  officialApiConfirmed: boolean;
  questionnaireAnswered: boolean;
  localMiddlewareRequired: boolean;
  cloudRelayAvailable: boolean;
  partnerStatus: "PARTNER_PROCESS_PENDING" | "AUTHORIZED_API" | "EXPORT_IMPORT_ONLY" | "UNSUPPORTED";
  interimPath: "EXPORT_IMPORT_V1";
  clinicsWaiting: number;
  mrrWaitingEur: number;
  manualMinutesPerWeek: number;
}

export interface RolloutStageResult {
  stage: 1 | 2 | 3;
  clinics: string[];
  clinicsCount: number;
  syncSuccessRatePct: number;
  duplicateObjects: number;
  conflictsResolved: number;
  clinicalDataIngestedCount: number;
  securityIncidentsCount: number;
  duplicateEntryReductionPct: number;
  status: "PASSED" | "FAILED";
}

export interface PrioritizationAnalysis {
  strategicOpportunityLeader: "GESDEN";
  strategicLeaderEvidence: string;
  strategicScores: {
    gesdenScore: number;
    newsoftScore: number;
  };
  buildNowReadinessLeader: "NEWSOFT";
  buildNowLeaderEvidence: string;
  readinessScores: {
    newsoftScore: number;
    gesdenScore: number;
  };
}

export interface Pilot11MetricsReport {
  pilot: 11;
  status: "COMPLETE" | "PARTIAL" | "FAIL";
  newsoftAuthorization: "VERIFIED" | "BLOCKED";
  newsoftClinicsConnected: number;
  newsoftSyncSuccess: number;
  newsoftDuplicates: number;
  newsoftConflictRatePct: number;
  newsoftClinicalDataIngested: 0;
  newsoftDuplicateEntryReductionPct: number;
  newsoftSupportChangeMinutes: number;
  newsoftDealsUnblocked: number;
  newsoftMrrUnblockedEur: number;
  newsoftConnectorResult: "PRODUCTIONIZED" | "PARTIAL" | "BLOCKED";
  gesdenVendorContact: "COMPLETED";
  gesdenG5ApiConfirmed: "NO" | "YES" | "PENDING";
  gesdenAuthorizedPath: "EXPORT_IMPORT_V1 (Partner Program Pending)";
  gesdenPartnerStatus: "PARTNER_PROCESS_PENDING";
  gesdenClinicsWaiting: number;
  gesdenMrrWaitingEur: number;
  gesdenInterimPath: "EXPORT_IMPORT_V1";
  gesdenConnectorResult: "AUTHORIZED" | "PARTNER_PENDING" | "EXPORT_IMPORT_ONLY" | "BLOCKED";
  infomedDentool: "WATCHLIST";
  strategicOpportunityLeader: "GESDEN";
  buildNowReadinessLeader: "NEWSOFT";
  productionSafetyIncidents: "NONE";
  securityIncidents: "NONE";
  clinicalDataIncidents: "NONE";
  nextSingleBottleneck: string;
  rolloutStages: RolloutStageResult[];
}
