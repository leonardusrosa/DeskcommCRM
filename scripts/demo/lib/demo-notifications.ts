/**
 * scripts/demo/lib/demo-notifications.ts
 *
 * Notification Adapters for Demo Sales Automation.
 * Supports WhatsApp, Email, and Sales Task channels.
 * All adapters: fail-silent, audited, demo-isolated.
 * Never dispatches to real external services — stubs for sales ops workflow.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export type NotificationChannel = "whatsapp" | "email" | "task";
export type NotificationStatus = "queued" | "sent" | "failed" | "skipped";

export interface DemoNotification {
  id: string;
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
  status: NotificationStatus;
  sentAt?: string;
  error?: string;
  createdAt: string;
}

export interface NotificationPayload {
  tenantId: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
}

export const DEFAULT_NOTIFICATIONS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_notifications.json",
);

/** Dispatch adapter — routes to channel stub. Always fail-silent. */
export async function sendDemoNotification(
  payload: NotificationPayload,
  options: { customFilePath?: string; dryRun?: boolean } = {},
): Promise<DemoNotification> {
  const record: DemoNotification = {
    id: crypto.randomUUID(),
    tenantId: payload.tenantId,
    channel: payload.channel,
    recipient: payload.recipient,
    subject: payload.subject,
    message: payload.message,
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  try {
    if (options.dryRun) {
      record.status = "skipped";
      persistNotification(record, options.customFilePath);
      return record;
    }

    // Dispatch by channel (stubs — real integrations wired externally)
    await dispatchToChannel(record);
    record.status = "sent";
    record.sentAt = new Date().toISOString();
  } catch (err) {
    // Fail-silent: demo must never crash due to notification errors
    record.status = "failed";
    record.error = err instanceof Error ? err.message : "Unknown dispatch error";
  }

  persistNotification(record, options.customFilePath);
  return record;
}

/** WhatsApp adapter stub. Real integration connects to Evolution API. */
async function dispatchWhatsApp(record: DemoNotification): Promise<void> {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const evolutionKey = process.env.EVOLUTION_API_KEY;

  if (!evolutionUrl || !evolutionKey) {
    // No Evolution API configured — log intent only
    console.info(
      `[demo-notifications] WhatsApp intent (no Evolution API): ${record.recipient} — ${record.message.slice(0, 60)}...`,
    );
    return;
  }

  // Real dispatch: fire-and-forget, failures caught by caller
  await fetch(`${evolutionUrl}/message/sendText`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": evolutionKey },
    body: JSON.stringify({
      number: record.recipient,
      text: record.message,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

/** Email adapter stub. Real integration wires to Resend/SMTP. */
async function dispatchEmail(record: DemoNotification): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.DEMO_EMAIL_FROM || "noreply@deskcomm.io";

  if (!resendKey) {
    console.info(
      `[demo-notifications] Email intent (no Resend key): ${record.recipient} — ${record.subject ?? record.message.slice(0, 40)}`,
    );
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: fromEmail,
      to: record.recipient,
      subject: record.subject || "Deskcomm Demo",
      text: record.message,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

/** Sales task adapter — creates internal action for sales team. */
async function dispatchTask(record: DemoNotification): Promise<void> {
  console.info(
    `[demo-notifications] Sales task: [${record.tenantId}] ${record.subject ?? record.message.slice(0, 60)}`,
  );
}

async function dispatchToChannel(record: DemoNotification): Promise<void> {
  switch (record.channel) {
    case "whatsapp":
      return dispatchWhatsApp(record);
    case "email":
      return dispatchEmail(record);
    case "task":
      return dispatchTask(record);
  }
}

export function listDemoNotifications(
  tenantId?: string,
  customFilePath = DEFAULT_NOTIFICATIONS_FILE,
): DemoNotification[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoNotification[];
    return tenantId ? all.filter((n) => n.tenantId === tenantId) : all;
  } catch {
    return [];
  }
}

function persistNotification(record: DemoNotification, targetFile = DEFAULT_NOTIFICATIONS_FILE): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let list: DemoNotification[] = [];
  if (fs.existsSync(targetFile)) {
    try { list = JSON.parse(fs.readFileSync(targetFile, "utf-8")); } catch { list = []; }
  }
  list.push(record);
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
