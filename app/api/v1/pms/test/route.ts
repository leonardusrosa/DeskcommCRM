/**
 * POST /api/v1/pms/test
 *
 * Validates connection to a PMS vendor bridge (NewSoft DS).
 * Gated by PMS_NEWSOFT_ENABLED environment rollout flag.
 * Enforces SSRF prevention on endpoint URL.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isPmsRolloutEnabled, newSoftProductionConnector, assertSafePmsEndpoint } from "@/lib/integrations/pms";

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
    };

    const tenantId = body.tenantId?.trim();
    const endpointUrl = body.endpointUrl?.trim();
    const clinicApiKey = body.clinicApiKey?.trim();

    if (!tenantId || !endpointUrl || !clinicApiKey) {
      return NextResponse.json(
        { error: "Missing required fields: tenantId, endpointUrl, and clinicApiKey are required." },
        { status: 400 }
      );
    }

    // 2. Enforce SSRF protection before any network call
    assertSafePmsEndpoint(endpointUrl);

    // 3. Test connector
    newSoftProductionConnector.testConnection({
      tenantId,
      endpointUrl,
      clinicApiKey,
      appointmentWriteEnabled: false,
    });

    return NextResponse.json({
      success: true,
      message: "Ligação ao NewSoft Sync Bridge estabelecida com sucesso.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("SSRF") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
