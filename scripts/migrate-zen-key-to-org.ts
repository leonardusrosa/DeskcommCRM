
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptKey, bufToBytea } from "@/lib/crypto/aes_gcm";
import { validateProviderKey } from "@/lib/ai/provider-validators";

async function run() {
  const zenKey = process.env.OPENCODE_ZEN_API_KEY?.trim();
  if (!zenKey) {
    console.log("No OPENCODE_ZEN_API_KEY in environment to migrate.");
    return;
  }

  const admin = createAdminClient();
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("id, slug, display_name, created_by")
    .limit(10);

  if (error || !orgs || orgs.length === 0) {
    console.error("No organizations found:", error);
    return;
  }

  for (const org of orgs) {
    // Check if org already has an opencode_zen credential
    const { data: existing } = await admin
      .from("ai_provider_credentials")
      .select("id")
      .eq("organization_id", org.id)
      .eq("provider", "opencode_zen")
      .eq("is_active", true)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Org ${org.slug} already has opencode_zen credential.`);
      continue;
    }

    console.log(`Migrating OpenCode Zen key into org ${org.slug} (${org.id})...`);
    const enc = encryptKey(zenKey);
    const val = await validateProviderKey("opencode_zen", zenKey);

    const { data: inserted, error: insertErr } = await admin
      .from("ai_provider_credentials")
      .insert({
        organization_id: org.id,
        provider: "opencode_zen",
        label: "Chave OpenCode Zen (Migrada da Instalação)",
        api_key_encrypted: bufToBytea(enc.ciphertext),
        api_key_iv: bufToBytea(enc.iv),
        api_key_tag: bufToBytea(enc.tag),
        api_key_last4: enc.last4,
        is_active: true,
        validated_at: val.ok ? new Date().toISOString() : new Date().toISOString(),
        validation_error: val.ok ? null : val.error,
        models_available: val.ok ? val.models : [],
        created_by: org.created_by || null,
      })
      .select("id, api_key_last4")
      .single();

    if (insertErr) {
      console.error(`Failed to insert credential for ${org.slug}:`, insertErr);
    } else {
      console.log(`Successfully migrated Zen credential for ${org.slug}: id=${inserted.id}, last4=••••${inserted.api_key_last4}`);
    }
  }
}

run().catch((e) => {
  console.error("Migration error:", e);
  process.exit(1);
});
