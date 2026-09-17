/**
 * POST /api/v1/pms/sync
 *
 * Triggers a bounded PMS synchronization run (initial_sync, incremental_sync).
 * Gated by PMS_NEWSOFT_ENABLED environment rollout flag.
 * Enforces SSRF prevention and tenant isolation.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  isPmsRolloutEnabled,
  pmsSyncEngine,
  NEWSOFT_CAPABILITIES,
  type PmsConnection,
} from "@/lib/integrations/pms";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Platform rollout gate: refuse execution if PMS is disabled
  if (!isPmsRolloutEnabled()) {
    return NextResponse.json(
      {
        error:
          "PMS NewSoft integration is disabled by platform rollout gate (PMS_NEWSOFT_ENABLED != true).",
      },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as {
      tenantId?: string;
      endpointUrl?: string;
      clinicApiKey?: string;
      jobType?: "initial_sync" | "incremental_sync" | "reconcile";
      windowDays?: number;
    };

    const tenantId = body.tenantId?.trim();
    const endpointUrl = body.endpointUrl?.trim();
    const clinicApiKey = body.clinicApiKey?.trim();
    const jobType = body.jobType ?? "incremental_sync";

    if (!tenantId || !endpointUrl || !clinicApiKey) {
      return NextResponse.json(
        { error: "Missing required fields: tenantId, endpointUrl, and clinicApiKey are required." },
        { status: 400 }
      );
    }

    const connection: PmsConnection = {
      id: `pms-conn-${tenantId}`,
      tenantId,
      provider: "newsoft_ds",
      status: "connected",
      health: "HEALTHY",
      syncEnabled: true,
      appointmentWriteEnabled: false,
      endpointUrl,
      encryptedSecretRef: `enc-${tenantId}`,
      last4: clinicApiKey.slice(-4),
      capabilities: { ...NEWSOFT_CAPABILITIES },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await pmsSyncEngine.executeSyncJob({
      connection,
      config: {
        tenantId,
        endpointUrl,
        clinicApiKey,
        appointmentWriteEnabled: false,
      },
      jobType,
      windowDays: body.windowDays,
    });

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("SSRF") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
