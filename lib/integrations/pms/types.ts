/**
 * lib/integrations/pms/types.ts
 *
 * Core production types for the Deskcomm PMS interoperability layer (pms_bridge_v1).
 * Strictly defines administrative contracts, multi-tenant isolation,
 * capability boundaries, mapping entities, and audit events.
 */

export type PmsProviderName = "newsoft_ds" | "gesden" | "infomed_dentool";

export type PmsConnectionStatus = "connected" | "disconnected" | "error" | "disabled";

export type PmsHealthState = "HEALTHY" | "DEGRADED" | "FAILED" | "DISABLED";

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

export interface PmsConnection {
  id: string;
  tenantId: string;
  provider: PmsProviderName;
  status: PmsConnectionStatus;
  health: PmsHealthState;
  syncEnabled: boolean;
  appointmentWriteEnabled: boolean;
  endpointUrl: string;
  encryptedSecretRef: string;
  last4: string;
  capabilities: PmsCapabilityModel;
  lastSyncAt?: string;
  lastSuccessAt?: string;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PmsExternalMappingRecord {
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

export interface AdministrativeContact {
  externalId: string;
  name: string;
  phone: string;
  email: string;
}

export interface AdministrativeAppointment {
  externalId: string;
  patientExternalId: string;
  start: string;
  end: string;
  provider: string;
  status: string;
  appointmentLabel: string;
}

export interface PmsSyncResult {
  tenantId: string;
  provider: PmsProviderName;
  syncRunId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  contactsRead: number;
  contactsMapped: number;
  appointmentsRead: number;
  appointmentsMapped: number;
  duplicatesDetected: number;
  conflictsDetected: number;
  errorsCount: number;
  durationMs: number;
  syncedAt: string;
}

export type PmsAuditAction =
  | "connection_created"
  | "connection_tested"
  | "connection_enabled"
  | "initial_sync_started"
  | "initial_sync_completed"
  | "sync_failed"
  | "conflict_detected"
  | "conflict_resolved"
  | "connection_disabled"
  | "credential_rotated";

export interface PmsAuditEvent {
  id: string;
  tenantId: string;
  provider: PmsProviderName;
  action: PmsAuditAction;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
