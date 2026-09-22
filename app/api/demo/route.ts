import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDentalDemoTemplate } from "@/lib/demo/templates";
import { provisionDentalDemo } from "@/lib/demo/provision";
import { consumeDemoProvisionAttempt } from "@/lib/demo/rate-limit";
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

    // Demo visitors should not need to copy disposable credentials. Establish
    // the just-created synthetic owner's session server-side and let the
    // browser redirect straight into the app. Credentials are returned only as
    // a fallback if GoTrue cannot establish the session.
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: demo.ownerEmail,
      password: demo.password,
    });

    if (!authError && authData.user) {
      return NextResponse.json({
        success: true,
        data: {
          autoLogin: true,
          launchUrl: "/app",
          clinicName: demo.clinicName,
          country: demo.country,
          syntheticData: true,
          expiresInHours: 48,
        },
      });
    }

    console.warn("[demo] provisioned but automatic session handoff failed", {
      tenantId: demo.tenantId,
      country: demo.country,
      reason: authError?.message ?? "missing_user",
    });

    return NextResponse.json({
      success: true,
      data: {
        autoLogin: false,
        launchUrl: "/login",
        clinicName: demo.clinicName,
        country: demo.country,
        syntheticData: true,
        expiresInHours: 48,
        fallbackCredentials: {
          ownerEmail: demo.ownerEmail,
          password: demo.password,
        },
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
