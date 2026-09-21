import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { isSyntheticDemoChannelMetadata } from "@/lib/demo/runtime";
import { isExpiredDemoSettings } from "@/lib/demo/expiry";
import { cleanupExpiredDemos } from "@/lib/demo/cleanup";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn(),
  resolveActiveOrg: vi.fn(),
  mfaEmDivida: vi.fn(async () => false),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/waha/client", () => ({
  getWahaClient: vi.fn(() => ({
    stopSession: vi.fn(),
    logoutSession: vi.fn(),
    startSession: vi.fn(),
    getVerifiedSession: vi.fn(),
  })),
  wahaFriendlyError: (m: string) => m,
}));

describe("synthetic demo channel metadata & safety checks", () => {
  it("identifies synthetic demo channel metadata correctly", () => {
    expect(isSyntheticDemoChannelMetadata({ demo: true, synthetic: true })).toBe(true);
    expect(isSyntheticDemoChannelMetadata({ demo: true })).toBe(false);
    expect(isSyntheticDemoChannelMetadata({ synthetic: true })).toBe(false);
    expect(isSyntheticDemoChannelMetadata(null)).toBe(false);
    expect(isSyntheticDemoChannelMetadata("string")).toBe(false);
    expect(isSyntheticDemoChannelMetadata({})).toBe(false);
  });

  it("reconnect route returns 409 demo_synthetic_channel for synthetic channels", async () => {
    const orgId = "11111111-1111-4111-8111-111111111111";
    const channelId = "22222222-2222-4222-8222-222222222222";
    vi.mocked(requireRole).mockResolvedValueOnce({
      ok: true,
      user: { id: "user-1", idioma: "pt-BR" } as never,
      org: { orgId, name: "Demo Org", role: "admin" } as never,
    });

    const mockDb = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => ({
          data: {
            id: channelId,
            waha_session_name: "demo-synthetic",
            status: "WORKING",
            phone_number: "+573009990001",
            metadata: { demo: true, synthetic: true },
          },
          error: null,
        })),
      })),
    };
    vi.mocked(createClient).mockResolvedValueOnce(mockDb as never);

    const { POST: postReconnect } = await import(
      "@/app/api/v1/channel-sessions/[id]/reconnect/route"
    );
    const req = new NextRequest(`http://localhost/api/v1/channel-sessions/${channelId}/reconnect`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await postReconnect(req, { params: Promise.resolve({ id: channelId }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("demo_synthetic_channel");
  });

  it("qr route returns 409 with synthetic-demo state header for synthetic channels", async () => {
    const orgId = "11111111-1111-4111-8111-111111111111";
    const channelId = "22222222-2222-4222-8222-222222222222";
    const { loadAuthUser, resolveActiveOrg } = await import("@/lib/auth/server");
    vi.mocked(loadAuthUser).mockResolvedValueOnce({ id: "user-1" } as never);
    vi.mocked(resolveActiveOrg).mockResolvedValueOnce({ orgId, name: "Demo Org", role: "admin" } as never);

    const mockDb = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => ({
          data: {
            id: channelId,
            waha_session_name: "demo-synthetic",
            metadata: { demo: true, synthetic: true },
          },
          error: null,
        })),
      })),
    };
    vi.mocked(createClient).mockResolvedValueOnce(mockDb as never);

    const { GET: getQr } = await import("@/app/api/v1/channel-sessions/[id]/qr/route");
    const req = new Request(`http://localhost/api/v1/channel-sessions/${channelId}/qr`);
    const res = await getQr(req, { params: Promise.resolve({ id: channelId }) });
    expect(res.status).toBe(409);
    expect(res.headers.get("x-channel-state")).toBe("synthetic-demo");
  });
});

describe("demo expiry and cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("INTERNAL_CRON_SECRET", "cron_secret_test_12345");
    vi.stubEnv("INTERNAL_SECRET", "secret_test_12345");
    vi.stubEnv("DEMO_PROVISIONING_ENABLED", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects expired demo settings accurately", () => {
    const baseTime = Date.parse("2026-09-21T12:00:00.000Z");
    expect(isExpiredDemoSettings({ demo: true, demo_expires_at: "2026-09-21T11:59:59.000Z" }, baseTime)).toBe(true);
    expect(isExpiredDemoSettings({ demo: true, demo_expires_at: "2026-09-21T12:00:00.000Z" }, baseTime)).toBe(true);
    expect(isExpiredDemoSettings({ demo: true, demo_expires_at: "2026-09-21T12:00:01.000Z" }, baseTime)).toBe(false);
    expect(isExpiredDemoSettings({ demo: false, demo_expires_at: "2026-09-20T00:00:00.000Z" }, baseTime)).toBe(false);
    expect(isExpiredDemoSettings(null, baseTime)).toBe(false);
  });

  it("cleanupExpiredDemos deletes organizations and their auth users", async () => {
    const orgId = "org-expired-1";
    const userIds = ["user-1", "user-2"];
    const deleteUser = vi.fn(async () => ({ error: null }));

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            lte: vi.fn(async () => ({ data: [{ id: orgId }], error: null })),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        if (table === "user_organizations") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn(async () => ({
              data: userIds.map((u) => ({ user_id: u })),
              error: null,
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      auth: {
        admin: {
          deleteUser,
        },
      },
    };

    const result = await cleanupExpiredDemos(admin as never, new Date());
    expect(result.organizationsDeleted).toBe(1);
    expect(result.usersDeleted).toBe(2);
    expect(deleteUser).toHaveBeenCalledTimes(2);
  });

  it("cron /api/v1/cron/demo-expiry requires bearer auth", async () => {
    const req = new NextRequest("http://localhost/api/v1/cron/demo-expiry", {
      headers: { authorization: "Bearer invalid" },
    });
    const { GET: getDemoExpiry } = await import("@/app/api/v1/cron/demo-expiry/route");
    const res = await getDemoExpiry(req);
    expect(res.status).toBe(403);
  });

  it("cron /api/v1/cron/demo-expiry skips execution when demo provisioning is disabled", async () => {
    const { GET: getDemoExpiry } = await import("@/app/api/v1/cron/demo-expiry/route");
    const req = new NextRequest("http://localhost/api/v1/cron/demo-expiry", {
      headers: { authorization: "Bearer cron_secret_test_12345" },
    });
    const res = await getDemoExpiry(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.skipped).toBe(true);
  });
});
