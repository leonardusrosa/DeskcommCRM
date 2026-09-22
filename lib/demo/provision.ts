import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertDemoProvisioningAllowed } from "./safety";
import {
  createDemoOrganization,
  createDemoUsers,
  demoEmail,
  seedDemoInfrastructure,
} from "./provision-core";
import { seedDemoAppointments, seedDemoContacts } from "./provision-content";
import type { DentalDemoTemplate, DemoProvisionSummary } from "./types";

function instanceToken(): string {
  return crypto.randomBytes(4).toString("hex");
}

function demoPassword(): string {
  return `Demo-${crypto.randomBytes(12).toString("base64url")}`;
}

export async function provisionDentalDemo(
  template: DentalDemoTemplate,
  requestedCompany?: string,
): Promise<DemoProvisionSummary> {
  assertDemoProvisioningAllowed();
  const admin = createAdminClient();
  const token = instanceToken();
  const password = demoPassword();
  const slug = `${template.slug}-${token}`;
  const createdUserIds: string[] = [];
  let orgId: string | null = null;

  try {
    orgId = await createDemoOrganization(admin, template, slug, requestedCompany);

    const createdUsers = await createDemoUsers(
      admin,
      orgId,
      template,
      token,
      password,
    );
    createdUserIds.push(...createdUsers.createdUserIds);

    const infrastructure = await seedDemoInfrastructure(
      admin,
      orgId,
      template,
      token,
      createdUsers.users,
    );

    const contacts = await seedDemoContacts(admin, {
      orgId,
      template,
      token,
      pipelineId: infrastructure.pipelineId,
      stages: infrastructure.stages,
      channelId: infrastructure.channelId,
      operatorId: infrastructure.operatorId,
    });

    await seedDemoAppointments(admin, {
      orgId,
      template,
      contacts,
      eventTypes: infrastructure.eventTypes,
      users: createdUsers.users,
      ownerId: infrastructure.ownerId,
    });

    return {
      tenantId: orgId,
      slug,
      clinicName: requestedCompany?.trim() || template.orgName,
      country: template.country,
      ownerEmail: demoEmail(template.users[0]!.email, token),
      ownerUserId: createdUsers.users.get("owner")!.id,
    };
  } catch (error) {
    if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    throw error;
  }
}
