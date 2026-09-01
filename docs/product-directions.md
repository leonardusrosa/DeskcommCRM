# DeskcommCRM — Locked Product Directions

Last updated: 2026-09-01

This document records product decisions that are considered **locked direction** for the DeskcommCRM fork. It is a roadmap/architecture note only; entries here are not evidence that the feature is already implemented.

## 1. Google Review Lite — LOCKED

### Product goal

Add a lightweight post-service Google review workflow directly inside DeskcommCRM, primarily through the existing WhatsApp channel.

### MVP behavior

- Organization stores its Google review URL.
- Organization can edit a review-request template.
- DeskcommCRM can send the review request automatically after a configured business/CRM milestone, and operators can also trigger it manually.
- The system records that the request was sent, when, to whom, and which trigger caused it.
- The system prevents accidental duplicate/repeated review requests according to configurable rules.
- Existing communication/opt-out rules must be respected.
- Review-request actions should be auditable.

Example message:

> Aproveitando...
>
> Sua avaliação no Google é muito importante para o nosso escritório e ajuda outras pessoas a conhecerem nosso trabalho.
>
> Você pode contar brevemente como foi o atendimento, a clareza das orientações e o acompanhamento do seu caso, sem mencionar informações pessoais.
>
> Avalie pelo link:
> <GOOGLE_REVIEW_URL>

### Integration direction

The MVP should **not require Google Business Profile API access** merely to send a review-request link. Sending the organization's configured Google review URL through WhatsApp is sufficient for the first version.

Google Business Profile API integration may be considered later only for richer capabilities such as reliable review ingestion/status/analytics, and should remain a separate enhancement because it introduces additional OAuth/API policy complexity.

### Out of scope for Lite

- Scraping Google reviews.
- Guessing or claiming that a customer published a review without a reliable source of truth.
- Full reputation-management suite.

---

## 2. CRM AI Copilot — LOCKED

### Product goal

Add a built-in AI copilot for the human operator inside DeskcommCRM.

The copilot is **operator-facing and human-in-the-loop**, distinct from the autonomous customer-facing agent.

### Initial capabilities

The copilot should be able to use authorized CRM context such as:

- contact profile;
- current and historical conversations;
- opportunity/pipeline state;
- notes and relevant memory;
- follow-up history;
- scheduling context when the calendar module exists.

Expected operator functions include:

- summarize the current customer/conversation;
- explain what happened previously;
- suggest the next best action;
- draft a reply for operator approval;
- suggest qualification questions;
- identify missing CRM information;
- suggest opportunity/pipeline updates;
- answer natural-language questions about the current CRM context;
- surface relevant follow-ups and pending commitments.

### Safety/architecture direction

The copilot should not silently perform consequential CRM writes simply because it generated a suggestion. Mutating actions should use existing authorization/audit patterns and require an explicit action/confirmation where appropriate.

---

## 3. Google Calendar + Native Deskcomm Booking — LOCKED

### Product direction

Use **Google Calendar as the default scheduling engine** while DeskcommCRM owns the scheduling experience and CRM state.

The default architecture should **not require Cal.com or Calendly** if the desired workflow can be implemented cleanly with Google Calendar APIs.

Cal.com/Calendly can remain optional future adapters rather than core dependencies.

### What "native booking" means in practice

DeskcommCRM should expose scheduling directly inside its own CRM/chat UI while Google Calendar remains the external calendar/source used to calculate availability and create calendar events.

The intended flow is:

1. A calendar/account is connected to the organization/user.
2. Deskcomm reads Google Calendar availability/free-busy according to configured working hours, appointment duration, buffers and scheduling rules.
3. The AI agent or human operator can ask Deskcomm for available slots.
4. Deskcomm presents human-readable slot options inside the conversation/CRM.
5. The customer selects a slot.
6. Deskcomm creates the appointment in Google Calendar and stores a corresponding appointment record in CRM.
7. The appointment is linked to the relevant contact and, where applicable, opportunity/conversation/operator.
8. Deskcomm displays appointment status natively in CRM.
9. Deskcomm can reschedule or cancel the appointment and synchronize the corresponding Google Calendar event.
10. Reminder/confirmation workflows can use the existing messaging infrastructure.

### Minimum scheduling capabilities

- connect Google Calendar via OAuth;
- select which calendar(s) participate in availability;
- working hours and timezone;
- appointment/service types;
- duration;
- minimum notice;
- buffer before/after;
- maximum booking horizon;
- free/busy lookup;
- list/offer available slots;
- create appointment;
- reschedule appointment;
- cancel appointment;
- appointment/contact/opportunity linkage;
- CRM appointment status;
- confirmation/reminder hooks;
- audit trail;
- tools callable by the customer-facing AI agent and operator copilot under appropriate permissions.

### Source-of-truth boundary

Google Calendar is the **calendar engine/external event source**. DeskcommCRM remains the **business/CRM source of truth** for appointment metadata, contact/opportunity linkage, workflow state, audit history and automation triggers.

This separation allows the CRM to provide a native scheduling UX without embedding or self-hosting a separate booking platform.

---

## 4. Not in immediate scope

The following are explicitly not part of this locked near-term direction:

- omnichannel expansion;
- landing-page builder;
- mandatory Cal.com/Calendly dependency.

These may be revisited separately and should not block Google Review Lite, CRM AI Copilot, or Google Calendar-backed native booking.

## Suggested implementation order

1. **Google Review Lite** — smallest surface area; largely reuses existing WhatsApp, CRM trigger and audit primitives.
2. **Google Calendar foundation + native booking data model/tools** — larger feature but high-value and reusable by both autonomous agent and operators.
3. **CRM AI Copilot** — build against the stabilized CRM context and scheduling tools so the copilot can reason over appointments as part of normal CRM state.

Before implementation of each item, perform a read-only architecture audit and define exact DB/API/UI/runtime ownership boundaries. Do not infer that this document authorizes production deployment by itself.
