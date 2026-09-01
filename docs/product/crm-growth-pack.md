# CRM Growth Pack — Locked Product Decisions

Status: locked for implementation

## Scope

This document records the next CRM capabilities to add after the recommended AI kit work.

### 1. Google Calendar + native booking

Decision: use Google Calendar as the scheduling engine and build the booking experience natively inside Deskcomm. Do not add Cal.com/Calendly as a required dependency.

Goal:
- CRM operator sees availability directly inside Deskcomm.
- AI agent can offer real available time slots to the customer.
- Customer can choose a slot in the WhatsApp conversation or through a minimal booking link when useful.
- Deskcomm creates/updates/cancels the Google Calendar event and keeps the CRM record synchronized.

Expected capabilities:
- connect one or more Google calendars per organization/user;
- working hours and booking rules;
- event/service types and durations;
- buffers before/after appointments;
- minimum notice and booking horizon;
- free/busy lookup;
- timezone-safe slot generation;
- create, reschedule and cancel appointments;
- appointment status inside CRM/contact/conversation;
- reminders and follow-up hooks;
- agent tools for availability, booking, rescheduling and cancellation;
- operator booking UI inside Deskcomm;
- audit trail for scheduling changes.

Out of scope for first version:
- Cal.com/Calendly dependency;
- marketplace-style public scheduling pages;
- payments tied to booking;
- complex multi-resource scheduling unless required by a concrete customer.

### 2. Google Review Lite

Decision: build a lightweight review-request automation, not a full reputation-management suite.

Goal:
- after a configurable successful outcome, Deskcomm can send a Google review request through the existing WhatsApp channel;
- organization configures its Google review URL and message template;
- operator/automation can trigger it from CRM lifecycle events.

Expected capabilities:
- organization-level Google review URL;
- editable message template;
- manual send from contact/conversation/opportunity;
- automation trigger after configurable events (for example completed appointment, won opportunity, completed service);
- delay/cooldown and deduplication to avoid repeated asks;
- opt-out / do-not-request flag;
- audit log and status: eligible, scheduled, sent, skipped, failed;
- no requirement to read or reply to Google reviews in v1.

Example copy pattern:

> Aproveitando...\n>\n> Sua avaliação no Google é muito importante para o nosso escritório e ajuda outras pessoas a conhecerem nosso trabalho.\n>\n> Você pode contar brevemente como foi o atendimento, a clareza das orientações e o acompanhamento do seu caso, sem mencionar informações pessoais.\n>\n> Avalie pelo link:\n> {google_review_url}

### 3. CRM AI Copilot

Decision: add a built-in CRM copilot as a first-class Deskcomm capability.

Goal: assist the human operator using the CRM context without replacing the customer-facing agent.

Expected first capabilities:
- summarize contact/conversation/opportunity;
- answer questions about current CRM context;
- suggest next best action;
- draft a reply without sending automatically;
- extract/update structured CRM fields only after explicit operator action/confirmation where appropriate;
- surface stale leads, missing follow-ups and risks;
- explain why a lead/opportunity is classified in its current stage;
- use existing tenant context, conversation history, memories, opportunities and agent/tool architecture.

Safety/product rules:
- copilot and customer-facing agent remain separate surfaces and permissions;
- no automatic external send from copilot by default;
- tenant isolation and auditability are mandatory;
- reuse the existing AI provider/AI-point architecture where possible;
- costs must remain observable by provider/model/purpose.

## Delivery order

1. Google Calendar + native booking foundation
2. Google Review Lite
3. CRM AI Copilot

The features should be implemented incrementally behind explicit organization configuration and without changing existing customer-facing agent behavior by default.
