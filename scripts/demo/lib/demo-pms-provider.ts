/**
 * scripts/demo/lib/demo-pms-provider.ts
 *
 * PMS Provider contract, capability model, multi-tenant isolation,
 * and platform/connection kill switch for pms_bridge_v1.
 */

import type { PmsCapabilityModel, PmsProviderName } from "@/types/demo-pilot-11";

export interface PmsCredentials {
  tenantId: string;
  clinicApiKey: string;
  endpointUrl: string;
  encryptedSecret: string;
}

export interface AdministrativeContactPayload {
  externalId: string;
  name: string;
  phone: string;
  email: string;
}

export interface AdministrativeAppointmentPayload {
  externalId: string;
  patientExternalId: string;
  start: string;
  end: string;
  provider: string;
  status: string;
  appointmentLabel: string;
}

export interface PmsProvider {
  readonly name: PmsProviderName;
  getCapabilities(): PmsCapabilityModel;
  testConnection(credentials: PmsCredentials): boolean;
  listContacts(tenantId: string, options?: { limit?: number }): AdministrativeContactPayload[];
  listAppointments(
    tenantId: string,
    options: { startDate: string; endDate: string }
  ): AdministrativeAppointmentPayload[];
  createAppointment?(
    tenantId: string,
    appointment: Omit<AdministrativeAppointmentPayload, "externalId">
  ): AdministrativeAppointmentPayload;
  cancelAppointment?(tenantId: string, externalId: string): boolean;
}

// In-memory store for kill switches
const disabledTenants = new Set<string>();
const disabledProviders = new Set<PmsProviderName>();

export function isProviderEnabled(provider: PmsProviderName): boolean {
  return !disabledProviders.has(provider);
}

export function setProviderEnabled(provider: PmsProviderName, enabled: boolean): void {
  if (enabled) {
    disabledProviders.delete(provider);
  } else {
    disabledProviders.add(provider);
  }
}

export function isTenantSyncEnabled(tenantId: string): boolean {
  return !disabledTenants.has(tenantId);
}

export function setTenantSyncEnabled(tenantId: string, enabled: boolean): void {
  if (enabled) {
    disabledTenants.delete(tenantId);
  } else {
    disabledTenants.add(tenantId);
  }
}

export function assertTenantIsolation(callingTenantId: string, targetTenantId: string): void {
  if (callingTenantId !== targetTenantId) {
    throw new Error(
      `[Security Alert] Cross-tenant PMS access attempt blocked! Calling tenant "${callingTenantId}" cannot access target tenant "${targetTenantId}".`
    );
  }
}

export function assertProviderActive(provider: PmsProviderName, tenantId: string): void {
  if (!isProviderEnabled(provider)) {
    throw new Error(`[PMS Bridge Disabled] Provider "${provider}" is currently disabled platform-wide by kill switch.`);
  }
  if (!isTenantSyncEnabled(tenantId)) {
    throw new Error(`[PMS Bridge Disabled] PMS synchronization is disabled for tenant "${tenantId}".`);
  }
}
