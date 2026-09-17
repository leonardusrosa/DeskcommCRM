/**
 * Service-role PMS connection repository for workers/server routes.
 * Encrypted credential material is isolated from tenant-visible metadata.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptPmsSecret, encryptPmsSecret } from "./credentials";
import type { PmsCapabilityModel, PmsConnection, PmsProviderName } from "./types";

interface RuntimePmsConnection {
  connection: PmsConnection;
  clinicApiKey: string;
}

function toConnection(row: Record<string, unknown>): PmsConnection {
  return {
    id: String(row.id),
    tenantId: String(row.organization_id),
    provider: row.provider as PmsProviderName,
    status: row.status as PmsConnection["status"],
    health: row.health as PmsConnection["health"],
    syncEnabled: Boolean(row.sync_enabled),
    appointmentWriteEnabled: Boolean(row.appointment_write_enabled),
    endpointUrl: String(row.endpoint_url),
    encryptedSecretRef: `db:pms_connection_secrets:${String(row.id)}`,
    last4: String(row.last4 || "0000"),
    capabilities: row.capabilities as PmsCapabilityModel,
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : undefined,
    lastSuccessAt: row.last_success_at ? String(row.last_success_at) : undefined,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class PmsConnectionRepository {
  public async getRuntimeConnection(connectionId: string): Promise<RuntimePmsConnection> {
    const client = createAdminClient();
    const { data: connectionRow, error: connectionError } = await client
      .from("pms_connections")
      .select("*")
      .eq("id", connectionId)
      .single();
    if (connectionError || !connectionRow) {
      throw new Error(`[PMS Connection] Connection not found: ${connectionId}`);
    }

    const { data: secretRow, error: secretError } = await client
      .from("pms_connection_secrets")
      .select("credential_ciphertext,credential_iv,credential_tag")
      .eq("connection_id", connectionId)
      .eq("organization_id", connectionRow.organization_id)
      .single();
    if (secretError || !secretRow) {
      throw new Error(`[PMS Connection] Credential material unavailable: ${connectionId}`);
    }

    const clinicApiKey = decryptPmsSecret({
      ciphertextHex: String(secretRow.credential_ciphertext),
      ivHex: String(secretRow.credential_iv),
      tagHex: String(secretRow.credential_tag),
    });
    return { connection: toConnection(connectionRow), clinicApiKey };
  }

  public async upsert(params: {
    organizationId: string;
    provider: PmsProviderName;
    endpointUrl: string;
    clinicApiKey: string;
    capabilities: PmsCapabilityModel;
    syncEnabled?: boolean;
    appointmentWriteEnabled?: boolean;
  }): Promise<PmsConnection> {
    if (!params.endpointUrl.startsWith("https://")) {
      throw new Error("[PMS Connection] HTTPS endpoint required");
    }

    const encrypted = encryptPmsSecret(params.clinicApiKey);
    const client = createAdminClient();
    const { data, error } = await client
      .from("pms_connections")
      .upsert(
        {
          organization_id: params.organizationId,
          provider: params.provider,
          endpoint_url: params.endpointUrl,
          last4: encrypted.last4,
          capabilities: params.capabilities,
          sync_enabled: params.syncEnabled ?? true,
          appointment_write_enabled: params.appointmentWriteEnabled ?? false,
          status: "connected",
        },
        { onConflict: "organization_id,provider" }
      )
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(`[PMS Connection] Save failed: ${error?.message || "unknown error"}`);
    }

    const { error: secretError } = await client.from("pms_connection_secrets").upsert(
      {
        connection_id: data.id,
        organization_id: params.organizationId,
        credential_ciphertext: encrypted.ciphertextHex,
        credential_iv: encrypted.ivHex,
        credential_tag: encrypted.tagHex,
      },
      { onConflict: "connection_id" }
    );
    if (secretError) {
      throw new Error(`[PMS Connection] Credential save failed: ${secretError.message}`);
    }
    return toConnection(data);
  }

  public async recordSyncOutcome(
    connectionId: string,
    outcome: { success: boolean; health: PmsConnection["health"]; errorCode?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      health: outcome.health,
      last_sync_at: now,
      last_error_code: outcome.errorCode || null,
    };
    if (outcome.success) patch.last_success_at = now;

    const { error } = await createAdminClient()
      .from("pms_connections")
      .update(patch)
      .eq("id", connectionId);
    if (error) throw new Error(`[PMS Connection] Outcome update failed: ${error.message}`);
  }
}

export const pmsConnectionRepository = new PmsConnectionRepository();
