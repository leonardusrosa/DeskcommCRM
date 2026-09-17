/**
 * lib/integrations/pms/types.ts
 *
 * Core domain types and contracts for the Deskcomm PMS interoperability layer.
 * Enforces administrative non-clinical contracts and multi-tenant isolation.
 */

export type PmsProviderName = "newsoft_ds" | "gesden" | "infomed_dentool";

export type PmsHealthState = "HEALTHY" | "DEGRADED" | "FAILED" | "DISABLED";

export type SyncLifecycleState = "synced" | "pending" | "conflict" | "disabled";

export type SyncConflictType =
  | "contact_collision"
  | "ambiguous"
  | "stale_external"
  | "tombstoned";

export interface AdministrativeContact {
  externalId: string;
  name: string;
  phone: string;
  email: string;
  administrativeCategory?: string;
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
  status: "connected" | "disconnected" | "error";
  health: PmsHealthState;
  syncEnabled: boolean;
  appointmentWriteEnabled: boolean;
  endpointUrl: string;
  encryptedSecretRef: string;
  last4: string;
  capabilities: PmsCapabilityModel;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  lastSuccessAt?: string;
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
  phone?: string;
  email?: string;
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
  tombstonedCount: number;
  errorsCount: number;
  durationMs: number;
  syncedAt: string;
}

export interface PmsAuditEvent {
  id: string;
  tenantId: string;
  provider: PmsProviderName;
  action:
    | "connection_created"
    | "connection_enabled"
    | "connection_disabled"
    | "initial_sync_started"
    | "initial_sync_completed"
    | "incremental_sync_completed"
    | "conflict_detected"
    | "tombstone_enforced"
    | "sync_failed";
  metadata?: Record<string, unknown>;
  timestamp: string;
}
