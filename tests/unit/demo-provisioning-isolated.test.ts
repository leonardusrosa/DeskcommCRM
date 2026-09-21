import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { isPublicPath } from "@/lib/auth/public-paths";
import { getDentalDemoTemplate } from "@/lib/demo/templates";
import { GET as getCatalog } from "@/app/api/demo/catalog/route";
import { POST as postDemo } from "@/app/api/demo/route";
import * as safety from "@/lib/demo/safety";
import * as rateLimit from "@/lib/demo/rate-limit";

vi.mock("@/lib/demo/safety", async (importOriginal) => {
  const actual = await importOriginal<typeof safety>();
  return {
    ...actual,
    assertDemoProvisioningAllowed: vi.fn(),
    demoProvisioningEnabled: vi.fn(() => true),
  };
});

describe("demo public routes & middleware accessibility", () => {
  it("marks demo entrypoints as public paths", () => {
    expect(isPublicPath("/demo")).toBe(true);
    expect(isPublicPath("/demo/catalog")).toBe(true);
    expect(isPublicPath("/api/demo")).toBe(true);
    expect(isPublicPath("/api/demo/catalog")).toBe(true);
    expect(isPublicPath("/demo/subpath")).toBe(true);
  });

  it("GET /api/demo/catalog returns catalog items and provisioning flag", async () => {
    const res = await getCatalog();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.provisioningEnabled).toBe(true);
    expect(body.data.profiles).toHaveLength(4);
    const countries = body.data.profiles.map((p: { country: string }) => p.country).sort();
    expect(countries).toEqual(["CO", "ES", "MX", "PT"]);
  });
});

describe("POST /api/demo endpoint behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enforces rate limiting (429)", async () => {
    vi.spyOn(rateLimit, "consumeDemoProvisionAttempt").mockReturnValueOnce({
      allowed: false,
      retryAfterSeconds: 45,
    });
    const req = new NextRequest("http://localhost/api/demo", {
      method: "POST",
      body: JSON.stringify({ country: "CO" }),
    });
    const res = await postDemo(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
  });

  it("rejects invalid JSON body (400)", async () => {
    vi.spyOn(rateLimit, "consumeDemoProvisionAttempt").mockReturnValueOnce({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const req = new NextRequest("http://localhost/api/demo", {
      method: "POST",
      body: "invalid-json",
    });
    const res = await postDemo(req);
    expect(res.status).toBe(400);
  });

  it("rejects invalid country schema (422)", async () => {
    vi.spyOn(rateLimit, "consumeDemoProvisionAttempt").mockReturnValueOnce({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const req = new NextRequest("http://localhost/api/demo", {
      method: "POST",
      body: JSON.stringify({ country: "US" }),
    });
    const res = await postDemo(req);
    expect(res.status).toBe(422);
  });

  it("maps capacity error to 503", async () => {
    vi.spyOn(rateLimit, "consumeDemoProvisionAttempt").mockReturnValueOnce({
      allowed: true,
      retryAfterSeconds: 0,
    });
    vi.mocked(safety.assertDemoProvisioningAllowed).mockImplementationOnce(() => {
      throw new Error("Demo capacity reached. Try again later.");
    });
    const req = new NextRequest("http://localhost/api/demo", {
      method: "POST",
      body: JSON.stringify({ country: "MX" }),
    });
    const res = await postDemo(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("Demo capacity reached");
  });

  it("maps forbidden / disabled safety error to 503", async () => {
    vi.spyOn(rateLimit, "consumeDemoProvisionAttempt").mockReturnValueOnce({
      allowed: true,
      retryAfterSeconds: 0,
    });
    vi.mocked(safety.assertDemoProvisioningAllowed).mockImplementationOnce(() => {
      throw new Error("Demo provisioning is disabled.");
    });
    const req = new NextRequest("http://localhost/api/demo", {
      method: "POST",
      body: JSON.stringify({ country: "ES" }),
    });
    const res = await postDemo(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("unavailable on this installation");
  });
});

describe("dental demo templates structure for all 4 markets", () => {
  const targetMarkets = ["CO", "MX", "ES", "PT"] as const;

  it.each(targetMarkets)("market %s provides full template configuration", (country) => {
    const template = getDentalDemoTemplate(country);
    expect(template).toBeDefined();
    expect(template!.country).toBe(country);
    expect(template!.orgName).toBeTruthy();
    expect(template!.users.length).toBeGreaterThanOrEqual(3);
    expect(template!.services.length).toBeGreaterThanOrEqual(4);
    expect(template!.pipeline.stages.length).toBeGreaterThanOrEqual(5);
    expect(template!.contacts.length).toBeGreaterThanOrEqual(3);
    expect(template!.appointments.length).toBeGreaterThanOrEqual(3);

    const hasAdmin = template!.users.some((u) => u.role === "admin");
    const hasOperator = template!.users.some((u) => u.key === "operator");
    const hasProvider = template!.users.some((u) => u.isProvider);
    expect(hasAdmin).toBe(true);
    expect(hasOperator).toBe(true);
    expect(hasProvider).toBe(true);
  });
});
