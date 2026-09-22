import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDentalDemoTemplate } from "@/lib/demo/templates";
import { provisionDentalDemo } from "@/lib/demo/provision";
import { establishDemoSession } from "@/lib/demo/launch";
import { cleanupDemoOrganization } from "@/lib/demo/cleanup";
import { consumeDemoProvisionAttempt } from "@/lib/demo/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  country: z.enum(["CO", "MX", "ES", "PT"]),
  company: z.string().trim().min(2).max(120).optional(),
});

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = forwarded || req.headers.get("x-real-ip") || "unknown";
  const rate = consumeDemoProvisionAttempt(clientKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many demo requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid demo request.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const template = getDentalDemoTemplate(parsed.data.country);
  if (!template) {
    return NextResponse.json({ success: false, error: "Demo template not found." }, { status: 404 });
  }

  try {
    const demo = await provisionDentalDemo(template, parsed.data.company);
    const admin = createAdminClient();

    try {
      const sessionClient = await createClient();
      await establishDemoSession(admin, sessionClient, demo);
    } catch (launchError) {
      await cleanupDemoOrganization(admin, demo.tenantId).catch((cleanupError) => {
        console.error("[demo] failed to rollback launch", {
          tenantId: demo.tenantId,
          message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      });
      throw launchError;
    }

    // Deliberately return no credential, OTP, magic-link token or owner email.
    // The auth cookie has already been written by establishDemoSession().
    return NextResponse.json({
      success: true,
      data: {
        clinicName: demo.clinicName,
        country: demo.country,
        syntheticData: true,
        expiresInHours: 48,
        launchUrl: "/app",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to provision demo.";
    console.error("[demo] provisioning failed", { message });

    if (/disabled|forbidden/i.test(message)) {
      return NextResponse.json(
        { success: false, error: "Demo provisioning is unavailable on this installation." },
        { status: 503 },
      );
    }
    if (/capacity reached/i.test(message)) {
      return NextResponse.json(
        { success: false, error: "Demo capacity reached. Try again later." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to provision demo." },
      { status: 500 },
    );
  }
}
