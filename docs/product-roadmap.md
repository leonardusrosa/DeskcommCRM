# DeskcommCRM — Product Roadmap Decisions

Status: product decisions locked for the next CRM capability iteration. This document records scope and architecture direction; it does not mean these features are implemented yet.

## Scope boundaries

For this phase, omnichannel connectivity and landing-page building are explicitly out of scope.

## 1. Google Calendar-backed native booking

**Decision:** build the scheduling experience natively inside Deskcomm while using Google Calendar as the scheduling engine/source of truth. Do not require Cal.com or Calendly for the first implementation.

### Product behavior

- Deskcomm displays available appointment slots derived from Google Calendar.
- Operators can create, reschedule and cancel appointments without leaving the CRM.
- The AI agent can offer available times and perform controlled scheduling actions through dedicated tools.
- Appointments can be associated with CRM contacts, conversations and opportunities when applicable.

### Initial integration scope

- Google OAuth and tenant-scoped calendar connection.
- Selection of calendar(s) used for availability and booking.
- Free/busy lookup.
- Configurable timezone, business hours, appointment duration and buffers.
- Native availability and booking UI inside Deskcomm.
- Create, reschedule and cancel events.
- Conflict revalidation at booking time.
- Audit trail and tenant isolation.
- Agent tools for listing slots, creating appointments, rescheduling and canceling.

### Architecture rule

Google Calendar remains the canonical calendar backend. Deskcomm owns the CRM-native UX, business rules and AI/tool workflow. Avoid creating a second independent scheduling engine unless future requirements demonstrate the need.

### Deferred

- Cal.com/other scheduling engines as optional adapters.
- Complex team round-robin and resource scheduling.
- Booking payments.

## 2. Google Review Lite

**Decision:** implement the useful review-request workflow without depending on the Google Business Profile API.

### Product behavior

- Store a Google review URL per organization/location.
- Allow configurable review-request message/template.
- Send the request through an existing customer channel after an eligible CRM event, such as completed service or won opportunity.
- Support configurable delay/cooldown and safeguards against repeated requests.
- Respect opt-out and normal outbound messaging rules.
- Record request attempts/results in the audit/history layer.

### Architecture rule

The Lite feature sends the organization’s static Google review link. It does **not** read reviews, reply to reviews, calculate Google ratings or synchronize Google Business Profile data.

### Deferred / advanced Google Business Profile integration

Review ingestion, replying to reviews, location analytics and related Google Business Profile functionality require a separate advanced integration and the corresponding Google API authorization/onboarding work.

## 3. CRM AI Copilot

**Decision:** add a built-in operator-side AI copilot using Deskcomm’s existing CRM context and AI/provider infrastructure.

### Product behavior

The copilot assists the human operator rather than acting as the customer-facing autonomous agent. Initial capabilities should include:

- summarize the current conversation/contact/account context;
- answer CRM questions grounded in tenant data;
- suggest a reply;
- suggest the next best action;
- surface opportunity/deal risks or missing information;
- help prepare follow-ups and handoffs.

### Controlled actions

Where the copilot is later allowed to write CRM data or trigger external actions, destructive or consequential actions must use explicit controls/confirmation and existing tenant/audit boundaries.

### Architecture rule

Reuse the current AI provider/model configuration, CRM context primitives and tool architecture where possible. Do not create an unrelated second AI stack for the copilot.

## Implementation order (provisional)

1. Diagnose/fix current CRM blockers and complete the existing WhatsApp E2E.
2. Google Calendar integration + native booking.
3. Google Review Lite.
4. CRM AI Copilot.

The order can change based on implementation effort discovered during technical audits, but the product decisions above remain the current target.