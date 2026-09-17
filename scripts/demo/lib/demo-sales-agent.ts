/**
 * scripts/demo/lib/demo-sales-agent.ts
 *
 * Sales Agent Assistant with Human-in-the-Loop Approval Workflow.
 * Generates proactive sales interventions (e.g. WhatsApp follow-ups, proposal delivery,
 * trial extensions) that STRICTLY require operator approval before execution.
 *
 * Zero autonomous external communications without explicit human approval.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import { assertDemoEnvironmentSafety } from "./guards";
import { sendDemoNotification } from "./demo-notifications";
import { trackActivity } from "./demo-activity";
import type { DemoLead } from "./demo-leads";
import type { DemoDeal } from "./demo-deals";

export type AgentActionType =
  | "send_whatsapp_message"
  | "send_email_proposal"
  | "offer_trial_extension"
  | "escalate_to_executive"
  | "schedule_clinical_demo";

export type AgentApprovalStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "executed";

export interface AgentAction {
  id: string;
  leadId: string;
  tenantId: string;
  type: AgentActionType;
  title: string;
  rationale: string;
  proposedPayload: {
    recipient: string;
    channel: "whatsapp" | "email" | "internal";
    subject?: string;
    body: string;
    metadata?: Record<string, unknown>;
  };
  status: AgentApprovalStatus;
  proposedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  executedAt?: string;
  executionResult?: {
    success: boolean;
    error?: string;
  };
}

export const DEFAULT_AGENT_ACTIONS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_agent_actions.json",
);

function loadActions(filePath: string): AgentAction[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content) as AgentAction[];
  } catch {
    return [];
  }
}

function saveActions(filePath: string, actions: AgentAction[]): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(actions, null, 2), "utf8");
  } catch {
    // fail silent
  }
}

export function proposeAgentAction(
  input: {
    leadId: string;
    tenantId: string;
    type: AgentActionType;
    title: string;
    rationale: string;
    proposedPayload: AgentAction["proposedPayload"];
  },
  customFilePath = DEFAULT_AGENT_ACTIONS_FILE,
): AgentAction {
  assertDemoEnvironmentSafety();

  const actions = loadActions(customFilePath);
  const newAction: AgentAction = {
    id: `act_${crypto.randomUUID().slice(0, 8)}`,
    leadId: input.leadId,
    tenantId: input.tenantId,
    type: input.type,
    title: input.title,
    rationale: input.rationale,
    proposedPayload: input.proposedPayload,
    status: "pending_approval",
    proposedAt: new Date().toISOString(),
  };

  actions.unshift(newAction);
  saveActions(customFilePath, actions);
  return newAction;
}

export function approveAgentAction(
  actionId: string,
  operatorEmail: string,
  customFilePath = DEFAULT_AGENT_ACTIONS_FILE,
): AgentAction | null {
  assertDemoEnvironmentSafety();

  const actions = loadActions(customFilePath);
  const action = actions.find((a) => a.id === actionId);
  if (!action) return null;

  action.status = "approved";
  action.approvedAt = new Date().toISOString();
  action.approvedBy = operatorEmail;

  saveActions(customFilePath, actions);
  return action;
}

export function rejectAgentAction(
  actionId: string,
  reason: string,
  operatorEmail: string,
  customFilePath = DEFAULT_AGENT_ACTIONS_FILE,
): AgentAction | null {
  assertDemoEnvironmentSafety();

  const actions = loadActions(customFilePath);
  const action = actions.find((a) => a.id === actionId);
  if (!action) return null;

  action.status = "rejected";
  action.rejectedAt = new Date().toISOString();
  action.rejectionReason = reason;
  action.approvedBy = operatorEmail;

  saveActions(customFilePath, actions);
  return action;
}

export async function executeApprovedAction(
  actionId: string,
  customFilePath = DEFAULT_AGENT_ACTIONS_FILE,
): Promise<{ success: boolean; error?: string; action?: AgentAction }> {
  assertDemoEnvironmentSafety();

  const actions = loadActions(customFilePath);
  const action = actions.find((a) => a.id === actionId);
  if (!action) {
    return { success: false, error: "Action not found" };
  }

  // Strict guard: zero unapproved execution
  if (action.status !== "approved") {
    return {
      success: false,
      error: `CANNOT_EXECUTE_UNAPPROVED: Action status is "${action.status}". Explicit operator approval required.`,
    };
  }

  try {
    if (action.proposedPayload.channel === "whatsapp" || action.proposedPayload.channel === "email") {
      await sendDemoNotification({
        tenantId: action.tenantId,
        channel: action.proposedPayload.channel,
        recipient: action.proposedPayload.recipient,
        subject: action.proposedPayload.subject,
        message: action.proposedPayload.body,
      });
    }

    trackActivity(
      action.tenantId,
      "commercial_action",
      "agent_action_executed",
      `Executed intervention: ${action.type} to ${action.proposedPayload.recipient} (Approved by ${action.approvedBy})`,
      { metadata: { actionId: action.id, type: action.type, operator: action.approvedBy } },
    );

    action.status = "executed";
    action.executedAt = new Date().toISOString();
    action.executionResult = { success: true };
    saveActions(customFilePath, actions);

    return { success: true, action };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    action.executionResult = { success: false, error: errorMsg };
    saveActions(customFilePath, actions);
    return { success: false, error: errorMsg };
  }
}

export function listAgentActions(
  filters?: { status?: AgentApprovalStatus; tenantId?: string },
  customFilePath = DEFAULT_AGENT_ACTIONS_FILE,
): AgentAction[] {
  const actions = loadActions(customFilePath);
  return actions.filter((a) => {
    if (filters?.status && a.status !== filters.status) return false;
    if (filters?.tenantId && a.tenantId !== filters.tenantId) return false;
    return true;
  });
}

export function generateLeadInterventionProposal(
  lead: DemoLead,
  deal?: DemoDeal,
): { title: string; type: AgentActionType; rationale: string; payload: AgentAction["proposedPayload"] } {
  if (deal && deal.status === "proposal") {
    return {
      title: "Send Commercial Proposal Follow-up with Special Term",
      type: "send_whatsapp_message",
      rationale: "Deal is currently in proposal stage; 48h elapsed without acceptance signal.",
      payload: {
        recipient: lead.whatsapp || lead.email || "demo-lead@deskcomm.internal",
        channel: lead.whatsapp ? "whatsapp" : "email",
        subject: "Propuesta Deskcomm Odontología — Revisión personalizada",
        body: `Hola ${lead.name || "Doctor"}, quisiéramos coordinar 5 minutos para resolver cualquier inquietud sobre la propuesta del plan ${deal.plan}.`,
      },
    };
  }

  return {
    title: "Send Clinical Walkthrough Invitation",
    type: "schedule_clinical_demo",
    rationale: "Lead demonstrated interest in multi-chair agenda. Walkthrough will increase close probability.",
    payload: {
      recipient: lead.whatsapp || lead.email || "demo-lead@deskcomm.internal",
      channel: lead.whatsapp ? "whatsapp" : "email",
      subject: "Invitación a Demostración Clínica Deskcomm",
      body: `Hola ${lead.name || "Doctor"}, le invitamos a agendar un recorrido en vivo de 15 minutos enfocado en optimizar su clínica dental.`,
    },
  };
}
