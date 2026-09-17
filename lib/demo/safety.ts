const PRODUCTION_SUPABASE_REF = "zywwwvrotgqouxillpvi";

export function assertDemoProvisioningAllowed(): void {
  if (process.env.DEMO_PROVISIONING_ENABLED !== "true") {
    throw new Error("Demo provisioning is disabled.");
  }

  const urls = [
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_DB_URL || "",
  ];

  if (urls.some((value) => value.includes(PRODUCTION_SUPABASE_REF))) {
    throw new Error("Demo provisioning is forbidden against the production Supabase project.");
  }
}

export function demoProvisioningEnabled(): boolean {
  try {
    assertDemoProvisioningAllowed();
    return true;
  } catch {
    return false;
  }
}
