import { DEFAULT_CHANNEL_PROVIDER } from "./capabilities";

interface SyntheticDemoSessionInput {
  organizationId: string;
  token: string;
  phoneNumber: string;
  createdBy: string;
}

export function syntheticDemoChannelSessionRow(input: SyntheticDemoSessionInput) {
  if (DEFAULT_CHANNEL_PROVIDER !== "waha") {
    throw new Error("Synthetic demo session default transport is not implemented.");
  }

  return {
    organization_id: input.organizationId,
    provider: DEFAULT_CHANNEL_PROVIDER,
    waha_session_name: `demo-${input.token}`,
    webhook_secret_encrypted: "\\x64656d6f",
    status: "WORKING",
    phone_number: input.phoneNumber,
    display_name: "WhatsApp Demo",
    metadata: { demo: true, synthetic: true },
    created_by: input.createdBy,
  };
}
