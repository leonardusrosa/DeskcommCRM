# PRD 07 — Google Calendar + Native Booking, Google Review Lite e CRM AI Copilot

Status: **product direction locked after Phase 0 architecture audit**. Implementation pending.

## Locked product decisions

### 1. Google Calendar + native booking — LOCKED

- **No Cal.com/Calendly dependency for the core v1.**
- Deskcomm owns the scheduling UX and the canonical CRM appointment record.
- Google Calendar is the first external calendar engine for **free/busy, occupancy and event synchronization**.
- In practical terms, the CRM itself displays availability and offers scheduling options while using Google Calendar behind the scenes.
- Customers do not need to leave WhatsApp or open a Calendly-style page to book in the primary flow.
- Operators and the AI agent should be able to:
  - query available slots;
  - propose specific slots to a lead/customer;
  - create, reschedule and cancel appointments;
  - link appointments to contact, opportunity and conversation;
  - trigger confirmations and reminders through the existing WhatsApp/automation stack.
- The availability calculation combines:
  - Deskcomm working hours / attendant availability;
  - event type duration, buffers and minimum notice;
  - existing Deskcomm appointments;
  - Google Calendar FreeBusy blocks.
- When a slot is booked, Deskcomm creates the canonical appointment and synchronizes/creates the corresponding event in Google Calendar.
- The scheduling domain remains provider-agnostic. Google-specific IDs/tokens live behind an adapter, so another provider can be added later without redesigning the CRM domain.
- A public self-booking page may be considered later, but it is **not required for v1**.

Example primary flow:

1. Customer: “Queria marcar uma reunião na quinta.”
2. Agent calls `calendar_check_availability`.
3. Deskcomm combines working hours + local appointments + Google FreeBusy.
4. Agent: “Tenho 14h, 15h30 ou 17h. Qual prefere?”
5. Customer chooses 15h30.
6. Agent calls `calendar_create_appointment`.
7. Deskcomm stores the appointment, creates/syncs the Google event and schedules reminders.

### 2. Google Review Lite — LOCKED

- V1 does **not** require Google Business Profile review-reading/replying APIs.
- Each organization stores:
  - Google review URL;
  - configurable request template;
  - enabled state;
  - default delay;
  - cooldown/deduplication policy;
  - eligible triggers.
- Deskcomm can send the review request:
  - manually from the CRM;
  - after an appointment is completed;
  - after a successful service / opportunity won;
  - through automation rules.
- Review requests reuse the existing WhatsApp send path, throttle, opt-out/STOP behavior, audit and tenant controls.
- Recommended default cooldown: 90 days per contact, configurable.
- Full Google Business Profile integration (read reviews, reply, analytics) remains future scope.

Example template:

> Aproveitando...
>
> Sua avaliação no Google é muito importante para o nosso escritório e ajuda outras pessoas a conhecerem nosso trabalho.
>
> Você pode contar brevemente como foi o atendimento, a clareza das orientações e o acompanhamento do seu caso, sem mencionar informações pessoais.
>
> Avalie pelo link:
> {{google_review_url}}

### 3. CRM AI Copilot — LOCKED

- Built-in assistant for CRM operators/managers.
- Reuse the canonical CRM service layer and existing MCP tools instead of creating parallel business logic.
- Dedicated configurable AI point: `crm_copilot`.
- Initial read capabilities:
  - summarize contact/opportunity/conversation;
  - answer pipeline/follow-up/stalled-lead questions;
  - suggest next best action;
  - draft replies/follow-ups;
  - use the active conversation/lead as contextual scope when opened from Inbox/Kanban.
- Initial write capabilities:
  - create/update CRM records only through canonical tools;
  - explicit confirmation/gate before mutating actions in v1;
  - preserve RBAC, tenant isolation and audit.
- Recommended UI: collapsible right-side drawer available throughout the CRM.
- Mutating actions are rendered as proposals with **Confirmar e executar** / **Descartar** rather than being executed silently.

## Shared architecture principle

Appointments, review requests and copilot actions are CRM domain actions, not isolated integrations. Reuse existing:

- contacts/opportunities/conversations;
- `event_log` + workers;
- automation rules (`QUANDO / SE / ENTÃO`);
- MCP tools and in-process execution bridge;
- RBAC/RLS;
- audit log;
- WhatsApp throttle/STOP/anti-ban infrastructure;
- existing attendant availability and CRM lead links.

## Calendar domain — audited target architecture

Use three essential tables for v1:

### `calendar_connections`

Stores the tenant/user Google Calendar connection and encrypted OAuth material.

Key fields:
- `organization_id`
- `user_id`
- `account_email`
- encrypted refresh token
- scopes
- status
- token expiry

### `calendar_event_types`

Defines what can be booked.

Key fields:
- `organization_id`
- name / slug
- duration
- buffer before / after
- minimum notice
- active state

### `calendar_appointments`

Canonical Deskcomm appointment record.

Key fields:
- `organization_id`
- `event_type_id`
- `contact_id`
- `conversation_id`
- `owner_user_id`
- title
- `starts_at` / `ends_at` as `timestamptz`
- timezone
- status
- Google calendar/event references
- cancellation reason

Do not duplicate availability tables in v1: weekly working hours already belong to `attendant_availability.schedule`, and the event type carries duration/buffer/notice rules.

## Calendar tools for agent/copilot

Register canonical in-process tools:

- `calendar_check_availability`
- `calendar_create_appointment`
- `calendar_reschedule_appointment`
- `calendar_cancel_appointment`
- `calendar_get_upcoming`

The same services must back agent tools, Copilot, REST routes and UI actions. Do not duplicate scheduling business logic.

## Google Calendar integration behavior

### Connection

- Google OAuth per tenant/user.
- OAuth tokens encrypted at rest using the repository’s existing credential-encryption pattern.
- Offline refresh token support and proactive token refresh.
- Initial self-host strategy: **BYO Google OAuth credentials per installation**.
- Each self-hosted customer registers the CRM callback URL for its own domain.

### Availability

Available slots are computed from:

`attendant_availability.schedule`
minus Deskcomm appointments
minus Google Calendar FreeBusy blocks
minus event buffers
subject to minimum notice and timezone.

### Booking

Deskcomm is the canonical owner of the appointment state. Google Calendar is the external occupancy/calendar system.

Create flow:

1. Re-check availability immediately before booking.
2. Create/claim the Deskcomm appointment safely against double booking.
3. Create the Google Calendar event.
4. Persist the Google event reference.
5. Link appointment to the relevant CRM lead/contact/conversation.
6. Emit appointment event + audit record.
7. Schedule confirmations/reminders through the existing worker/cron path.

Reschedule/cancel operations follow the same canonical service and synchronize Google accordingly.

External Google edits/deletes should eventually be reconciled without making Google-specific fields part of the generic scheduling domain.

## Google Review Lite architecture

Store configuration in `organizations.settings.google_review`; no dedicated table is required for v1.

Suggested shape:

```json
{
  "google_review": {
    "enabled": true,
    "review_url": "https://g.page/r/example/review",
    "template": "Aproveitando...\n\nSua avaliação no Google é muito importante para nós.\n\nAvalie pelo link:\n{{google_review_url}}",
    "default_delay_minutes": 120,
    "cooldown_days": 90,
    "trigger_on_lead_won": true,
    "trigger_on_appointment_completed": true
  }
}
```

Expected safeguards:

- per-contact cooldown/deduplication;
- opt-out / blocked-contact validation;
- existing send ledger/throttle path;
- activity entry on the lead/contact timeline;
- central audit event `review.requested`;
- manual action from CRM side panel.

No Google OAuth is needed merely to send a configured `g.page/.../review` link.

## CRM AI Copilot architecture

- Register `crm_copilot` as an independent AI point so tenant admins can select its model.
- Reuse `buildAgentSystemContext` / canonical business context.
- Reuse the same MCP tool catalog through the existing in-process bridge.
- Read tools may execute directly according to RBAC/scope.
- Write tools require an explicit human confirmation proposal in v1.
- Server must validate that contextual conversation/lead/contact IDs belong to the authenticated organization before supplying them to the model.

Example mutation proposal:

```json
{
  "type": "proposal",
  "action": "crm_move_lead_stage",
  "summary": "Mover lead Maria Silva para o estágio 'Proposta Apresentada'",
  "payload": {
    "leadId": "uuid-123",
    "targetStageId": "stage-456"
  }
}
```

## Implementation order

The architecture audit is complete. Recommended implementation sequence:

### PR 1 — Google Review Lite

- Organization settings.
- Manual send action.
- Post-win / post-completed-appointment trigger support.
- Cooldown/dedupe.
- WhatsApp send integration and audit.
- No migration expected.

### PR 2 — Calendar schema + Google OAuth

- `calendar_connections`
- `calendar_event_types`
- `calendar_appointments`
- RLS / tenant constraints.
- Google connect/callback/token adapter.
- One schema migration expected.

### PR 3 — Availability engine + appointment APIs

- Mathematical slot engine.
- FreeBusy integration.
- Create/reschedule/cancel canonical service.
- Double-booking/idempotency protection.
- Google event synchronization.

### PR 4 — Native calendar/booking UI

- `/app/agenda`
- practical day/week view or appointment list
- create/reschedule/cancel modal
- availability picker
- contact/opportunity/inbox integration

### PR 5 — Scheduling tools + reminders

- Agent/Copilot scheduling tools.
- Appointment events.
- Confirmation/reminder jobs.
- Automation triggers/actions.

### PR 6 — CRM AI Copilot read-only

- `crm_copilot` AI point.
- streaming API.
- right-side drawer.
- canonical context + read tools.

### PR 7 — CRM AI Copilot confirmed mutations

- typed mutation proposals.
- Confirm/Discard UI.
- canonical tool execution after confirmation.
- audit.

## Constraints

- Tenant isolation and RBAC at every layer.
- Provider secrets never exposed to the client or stored in generic organization settings.
- External side effects must be idempotent/deduplicated.
- Do not duplicate business logic between route handlers, agent tools, Copilot and UI.
- Calendar sync must survive external edits/deletes and token revocation.
- Review Lite must not repeatedly message the same contact/interaction unless explicitly configured.
- Scheduling domain must not depend directly on Google-specific identifiers.
- Existing agent runtime and automation architecture should be reused rather than bypassed.
- Store appointment timestamps as `timestamptz` and treat timezone/DST explicitly.

## Out of scope for v1

- Omnichannel beyond existing WhatsApp.
- Landing-page builder.
- Cal.com/Calendly dependency.
- Full Google Business Profile review management.
- Public booking microsite unless separately prioritized.
- Complex room/equipment/resource scheduling until the basic attendee calendar model is proven.

## Definition of Done

- Google Calendar can be connected per tenant/install.
- Deskcomm displays availability directly and creates/reschedules/cancels appointments natively.
- Customer can book through the WhatsApp agent without leaving the conversation.
- Operator can book from the CRM without using an external scheduling UI.
- Appointments link to CRM records and synchronize with Google Calendar.
- Agent can offer/book/reschedule/cancel via controlled tools.
- Confirmations/reminders run through canonical workers/automation.
- Google Review Lite sends manually and via automation with dedupe/audit/throttle.
- CRM AI Copilot can summarize/query/draft and execute confirmed CRM mutations through canonical tools.
- E2E proves at least one real flow: WhatsApp -> native booking -> Google Calendar event -> reminder -> completion -> Google Review request.
