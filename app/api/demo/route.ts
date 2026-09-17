import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDentalDemoTemplate } from "@/lib/demo/templates";
import { provisionDentalDemo } from "@/lib/demo/provision";
import { consumeDemoProvisionAttempt } from "@/lib/demo/rate-limit";

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
    return NextResponse.json({
      success: true,
      data: {
        ...demo,
        syntheticData: true,
        expiresInHours: 48,
        loginUrl: "/login",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to provision demo.";
    const status = /disabled|forbidden/i.test(message) ? 503 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
