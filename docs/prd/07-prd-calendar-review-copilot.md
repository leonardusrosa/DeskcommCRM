# PRD 07 — Calendar, Native Booking, Google Review Lite e CRM AI Copilot

Status: product direction locked; implementation pending architecture audit.

## Product decisions

### Calendar + native booking

- Google Calendar is the first calendar engine/source of truth.
- Deskcomm owns the scheduling UX. Cal.com/Calendly are not dependencies for the core v1.
- The CRM should expose availability and booking directly inside Deskcomm while Google Calendar provides calendar synchronization/event storage.
- Operators and the AI agent should be able to:
  - query available slots;
  - propose slots to a lead/customer;
  - create, reschedule and cancel appointments;
  - link appointments to contact, opportunity and conversation;
  - trigger confirmations and reminders through the existing WhatsApp/automation stack.
- The scheduling domain must remain provider-agnostic. Google-specific IDs/tokens live behind an adapter so Cal.com or another engine can be added later without redesigning the CRM domain.

### Google Review Lite

- V1 does not require Google Business Profile review-reading/replying APIs.
- Each organization can store a Google review URL and a configurable request template.
- Deskcomm can send the request manually or through automation/follow-up rules.
- Recommended triggers include completed appointment / successful service / opportunity won, with configurable delay and deduplication.
- Review requests reuse existing WhatsApp throttle, STOP handling, audit and tenant controls.
- Full Google Business Profile integration (read/reply/analytics) is future scope.

### CRM AI Copilot

- Built-in assistant for CRM operators/managers.
- Reuse the canonical CRM service layer and existing MCP tools instead of creating parallel business logic.
- Initial read capabilities:
  - summarize contact/opportunity/conversation;
  - answer pipeline/follow-up/stalled-lead questions;
  - suggest next best action;
  - draft replies/follow-ups.
- Initial write capabilities:
  - create/update CRM records only through canonical tools;
  - explicit confirmation/gate before mutating actions in v1;
  - preserve RBAC, tenant isolation and audit.

## Shared architecture principle

Appointments, review requests and copilot actions are CRM domain actions, not isolated integrations. Reuse existing:

- contacts/opportunities/conversations;
- `event_log` + workers;
- automation rules (`QUANDO / SE / ENTÃO`);
- MCP tools;
- RBAC/RLS;
- audit log;
- WhatsApp throttle/STOP/anti-ban infrastructure.

## Recommended implementation order

### Phase 0 — read-only architecture audit

Map current schema/services/routes/UI for contacts, opportunities, conversations, automation rules, follow-up engine, scheduler/workers, MCP tools, audit and provider credentials.

Deliverables:
- compatibility/reuse matrix;
- exact files/functions/tables to extend;
- proposed migrations and API surface;
- risks around idempotency, OAuth, sync and external side effects;
- implementation split into small PRs.

No production mutation in this phase.

### Phase 1 — calendar domain + Google Calendar adapter

Introduce canonical scheduling entities before UI:

- calendar connection per organization;
- calendar/resource mapping;
- availability rules and timezone;
- appointments linked to CRM entities;
- provider references/sync metadata;
- audit and idempotency.

Implement Google OAuth and adapter capabilities:
- list selected calendars;
- free/busy;
- create event;
- update/reschedule event;
- cancel/delete event;
- handle token expiry/revocation;
- reconcile external edits/deletions.

### Phase 2 — native booking UX + agent tools

Add Deskcomm-native calendar/booking experience:
- day/week/calendar view or practical appointment list first;
- contact/opportunity side panel actions;
- availability picker;
- create/reschedule/cancel UI;
- confirmation state.

Expose canonical tools to the agent/copilot:
- get_available_slots;
- create_appointment;
- reschedule_appointment;
- cancel_appointment;
- get_upcoming_appointments.

Then wire confirmations/reminders to the existing worker/automation path.

### Phase 3 — Google Review Lite

Add organization settings:
- review URL;
- template;
- enabled state;
- default delay;
- optional eligibility rule.

Add actions:
- manual send from contact/opportunity/appointment;
- automation action `send_google_review_request`;
- dedupe per completed interaction;
- audit trail/status.

No Google Business Profile OAuth/API needed for Lite.

### Phase 4 — CRM AI Copilot

Add an internal copilot surface using the organization-selected/published model and canonical CRM tools.

Start read-heavy:
- summarize current record;
- pipeline queries;
- stalled leads / follow-ups;
- draft communication;
- next-action suggestions.

Then enable confirmed mutations through the same shared tools used by the agent.

Where practical, answers should deep-link to the source CRM records used.

## Constraints

- Tenant isolation and RBAC at every layer.
- Provider secrets never exposed to the client or stored in generic organization settings.
- External side effects must be idempotent/deduplicated.
- Do not duplicate business logic between route handlers, agent tools, copilot and UI.
- Calendar sync must survive external edits/deletes and token revocation.
- Review Lite must not repeatedly message the same completed interaction unless explicitly configured.
- Scheduling domain must not depend directly on Google-specific identifiers.
- Existing agent runtime and automation architecture should be reused rather than bypassed.

## Out of scope for v1

- Omnichannel beyond existing WhatsApp.
- Landing-page builder.
- Full Google Business Profile review management.
- Mandatory Cal.com/Calendly dependency.
- Complex resource scheduling until the basic calendar/appointment model is proven.

## Definition of Done

- Google Calendar can be connected per tenant.
- Deskcomm can show availability and create/reschedule/cancel appointments natively.
- Appointments link to CRM records and synchronize with Google Calendar.
- Agent can offer/book/reschedule/cancel via controlled tools.
- Confirmations/reminders run through canonical workers/automation.
- Google Review Lite sends manually and via automation with dedupe/audit/throttle.
- CRM AI Copilot can summarize/query/draft and execute confirmed CRM mutations through canonical tools.
- E2E proves at least one real flow: WhatsApp -> booking -> reminder -> completion -> review request.
