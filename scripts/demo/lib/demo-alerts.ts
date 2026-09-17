/**
 * scripts/demo/lib/demo-alerts.ts
 *
 * Demo Alert Engine.
 * Multi-channel alerts across WhatsApp, Slack, and Email.
 * Requirements: Fail-silent, demo-isolated, audited in .demo/demo_alerts.json.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export type AlertChannel = "whatsapp" | "slack" | "email";
export type AlertSeverity = "info" | "warning" | "critical";

export interface DemoAlertRecord {
  id: string;
  tenantId: string;
  channel: AlertChannel;
  severity: AlertSeverity;
  title: string;
  message: string;
  recipient: string;
  status: "sent" | "failed" | "skipped";
  sentAt?: string;
  error?: string;
  createdAt: string;
}

export interface SendAlertInput {
  tenantId: string;
  channel: AlertChannel;
  severity?: AlertSeverity;
  title: string;
  message: string;
  recipient: string;
}

export const DEFAULT_ALERTS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_alerts.json",
);

export async function sendDemoAlert(
  input: SendAlertInput,
  options: { customFilePath?: string; dryRun?: boolean } = {},
): Promise<DemoAlertRecord> {
  const record: DemoAlertRecord = {
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    channel: input.channel,
    severity: input.severity || "info",
    title: input.title,
    message: input.message,
    recipient: input.recipient,
    status: "skipped",
    createdAt: new Date().toISOString(),
  };

  if (options.dryRun) {
    persistAlert(record, options.customFilePath);
    return record;
  }

  try {
    switch (input.channel) {
      case "whatsapp":
        await dispatchWhatsApp(input);
        break;
      case "slack":
        await dispatchSlack(input);
        break;
      case "email":
        await dispatchEmail(input);
        break;
    }
    record.status = "sent";
    record.sentAt = new Date().toISOString();
  } catch (err) {
    // Fail silent: demo execution must never be disrupted
    record.status = "failed";
    record.error = err instanceof Error ? err.message : "Alert dispatch failed";
  }

  persistAlert(record, options.customFilePath);
  return record;
}

async function dispatchWhatsApp(input: SendAlertInput): Promise<void> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    console.info(`[demo-alerts] WhatsApp alert intent: ${input.recipient} — ${input.title}`);
    return;
  }

  await fetch(`${apiUrl}/message/sendText`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      number: input.recipient,
      text: `*[ALERTA ${input.severity?.toUpperCase() || "INFO"}]* ${input.title}\n\n${input.message}`,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

async function dispatchSlack(input: SendAlertInput): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.info(`[demo-alerts] Slack alert intent: [${input.severity}] ${input.title}`);
    return;
  }

  const icon = input.severity === "critical" ? "🚨" : input.severity === "warning" ? "⚠️" : "ℹ️";

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${icon} *${input.title}*\n${input.message}\n_Tenant: ${input.tenantId}_`,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

async function dispatchEmail(input: SendAlertInput): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.DEMO_ALERT_EMAIL_FROM || "alerts@deskcomm.io";

  if (!resendKey) {
    console.info(`[demo-alerts] Email alert intent: ${input.recipient} — ${input.title}`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: fromEmail,
      to: input.recipient,
      subject: `[ALERTA Deskcomm] ${input.title}`,
      text: `${input.title}\n\n${input.message}\n\nTenant: ${input.tenantId}`,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

export function listDemoAlerts(
  tenantId?: string,
  customFilePath = DEFAULT_ALERTS_FILE,
): DemoAlertRecord[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoAlertRecord[];
    return tenantId ? all.filter((a) => a.tenantId === tenantId) : all;
  } catch {
    return [];
  }
}

function persistAlert(record: DemoAlertRecord, targetFile = DEFAULT_ALERTS_FILE): void {
  try {
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let list: DemoAlertRecord[] = [];
    if (fs.existsSync(targetFile)) {
      try { list = JSON.parse(fs.readFileSync(targetFile, "utf-8")); } catch { list = []; }
    }
    list.push(record);
    fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
  } catch {
    // Fail silent
  }
}
