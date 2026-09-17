import { NextResponse } from "next/server";
import { DENTAL_DEMO_CATALOG } from "@/lib/demo/catalog";
import { demoProvisioningEnabled } from "@/lib/demo/safety";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      profiles: DENTAL_DEMO_CATALOG,
      provisioningEnabled: demoProvisioningEnabled(),
    },
  });
}
