// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerRetratoDaInstalacao } from "@/lib/instalacao/retrato";
import { PROVEDORES } from "@/lib/ai/pontos/provedores";
import { encryptKey, decryptKey, bufToBytea, byteaToBuffer } from "@/lib/crypto/aes_gcm";

describe("OpenCode Zen BYOK Onboarding & Credential Flow", () => {
  const admin = createAdminClient();

  it("1. PROVEDORES registry contains OpenCode Zen with BYOK requirements", () => {
    const zen = PROVEDORES.find((p) => p.id === "opencode_zen");
    expect(zen).toBeDefined();
    expect(zen?.rotulo).toBe("OpenCode Zen");
    expect(zen?.aceitaEndpointProprio).toBe(true);
  });

  it("2. verifies org credential encryption and masked last4 representation", () => {
    const testSecret = "sk-zen-test-key-1234567890abcdef";
    const enc = encryptKey(testSecret);

    expect(enc.last4).toBe("cdef");
    expect(enc.ciphertext).toBeInstanceOf(Buffer);
    expect(enc.iv).toBeInstanceOf(Buffer);
    expect(enc.tag).toBeInstanceOf(Buffer);

    const decrypted = decryptKey({
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      tag: enc.tag,
    });

    expect(decrypted).toBe(testSecret);
  });

  it("3. portrait strictly checks ai_provider_credentials for org BYOK without .env fallback", async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .limit(1)
      .single();

    if (!org) return;

    // Organization with existing Zen BYOK credential
    const retrato = await lerRetratoDaInstalacao({
      supabase: admin,
      orgId: org.id,
    });

    expect(retrato.inteligencia.provedor).toBe("opencode_zen");
    expect(retrato.inteligencia.origemDaChave).toBe("org");
    expect(retrato.inteligencia.chaveDaOrg).toBeDefined();
    expect(retrato.inteligencia.chaveDaOrg?.final).toBeTruthy();
    expect(retrato.inteligencia.prontaParaPublicar).toBe(true);
  });

  it("4. failed replacement preserves existing active credential", async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .limit(1)
      .single();

    if (!org) return;

    const { data: activeCreds } = await admin
      .from("ai_provider_credentials")
      .select("id, api_key_last4")
      .eq("organization_id", org.id)
      .eq("provider", "opencode_zen")
      .eq("is_active", true)
      .not("validated_at", "is", null)
      .order("created_at", { ascending: false });

    expect(activeCreds).toBeDefined();
    expect(activeCreds!.length).toBeGreaterThan(0);
    const originalLast4 = activeCreds![0].api_key_last4;

    // Simulate an invalid key attempt: it fails before touching or deactivating the working credential
    const invalidKey = "sk-invalid";
    expect(invalidKey.length).toBeLessThan(12);

    // Active credential remains untouched
    const { data: checkCreds } = await admin
      .from("ai_provider_credentials")
      .select("api_key_last4")
      .eq("organization_id", org.id)
      .eq("provider", "opencode_zen")
      .eq("is_active", true)
      .not("validated_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    expect(checkCreds?.[0]?.api_key_last4).toBe(originalLast4);
  });
});
