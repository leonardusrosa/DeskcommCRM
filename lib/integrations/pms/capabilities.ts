/**
 * lib/integrations/pms/capabilities.ts
 *
 * PMS capability discovery and enforcement model.
 * Guarantees runtime calls execute only vendor-authorized capabilities.
 */

import type { PmsCapabilityModel, PmsProviderName } from "./types";

export const NEWSOFT_CAPABILITIES: Readonly<PmsCapabilityModel> = Object.freeze({
  contactsRead: true,
  appointmentsRead: true,
  appointmentsCreate: true,
  appointmentsUpdate: true,
  appointmentsCancel: true,
  realtimeWebhooks: true,
  incrementalSync: true,
});

export const GESDEN_CAPABILITIES: Readonly<PmsCapabilityModel> = Object.freeze({
  contactsRead: true,
  appointmentsRead: true,
  appointmentsCreate: false,
  appointmentsUpdate: false,
  appointmentsCancel: false,
  realtimeWebhooks: false,
  incrementalSync: false,
});

export const INFOMED_DENTOOL_CAPABILITIES: Readonly<PmsCapabilityModel> = Object.freeze({
  contactsRead: true,
  appointmentsRead: true,
  appointmentsCreate: false,
  appointmentsUpdate: false,
  appointmentsCancel: false,
  realtimeWebhooks: false,
  incrementalSync: false,
});

export function getProviderDefaultCapabilities(provider: PmsProviderName): PmsCapabilityModel {
  switch (provider) {
    case "newsoft_ds":
      return { ...NEWSOFT_CAPABILITIES };
    case "gesden":
      return { ...GESDEN_CAPABILITIES };
    case "infomed_dentool":
      return { ...INFOMED_DENTOOL_CAPABILITIES };
    default:
      throw new Error(`[PMS Capabilities] Unknown PMS provider: "${provider}"`);
  }
}

export function assertOperationSupported(
  capabilities: PmsCapabilityModel,
  operation: keyof PmsCapabilityModel,
  provider: PmsProviderName
): void {
  if (!capabilities[operation]) {
    throw new Error(
      `[PMS Capability Violation] Operation "${operation}" is not supported or authorized by provider "${provider}".`
    );
  }
}
