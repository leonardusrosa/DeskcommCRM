# DeskcommCRM — Product Roadmap Decisions

This file records product decisions that are considered locked unless explicitly revisited.

## Locked product directions

### 1. Google Calendar + native booking

**Status:** locked for product design; implementation pending.

DeskcommCRM should use **Google Calendar as the calendar engine** while exposing a **native booking experience inside the CRM**.

The intended product behavior is:

- Connect one or more Google Calendar accounts/calendars per organization.
- Read real availability from Google Calendar.
- Let the CRM display available appointment slots to an operator.
- Let the AI agent offer valid appointment slots during a conversation.
- Let the operator or AI create, reschedule and cancel bookings through DeskcommCRM.
- Write the resulting event back to Google Calendar.
- Keep the contact/conversation/opportunity linked to the booking inside DeskcommCRM.
- Support configurable duration, buffers, working hours, minimum notice, scheduling horizon and timezone.
- Detect conflicts using Google Calendar free/busy before confirming.
- Persist a DeskcommCRM booking record with the Google Calendar event ID rather than treating the calendar event as the whole CRM record.
- Emit internal/audit events for booking created, rescheduled and cancelled.

This means the user does **not** need to operate a separate Cal.com/Calendly-style interface for the basic scheduling flow.

External scheduling engines such as Cal.com may be evaluated later as optional adapters, but they are **not required for v1** if Google Calendar provides the underlying availability/event engine.

#### Booking v1 scope

The first implementation should cover:

1. Google OAuth connection.
2. Calendar selection.
3. Booking configuration per organization and/or service.
4. Free/busy lookup.
5. Native DeskcommCRM availability UI.
6. CRM/AI tool for `list_available_slots`.
7. CRM/AI tool for `create_booking`.
8. Reschedule and cancellation.
9. Booking/contact/conversation linkage.
10. Confirmation and reminder hooks.

#### Non-goals for booking v1

- Building a full public scheduling SaaS comparable to Calendly or Cal.com.
- Payments for appointments.
- Complex round-robin/team routing.
- Multi-resource scheduling.
- Omnichannel scheduling entry points.

Those can be layered later without changing the Google Calendar-backed architecture.

---

### 2. Google Review Lite

**Status:** locked for product design; implementation pending.

DeskcommCRM should include a lightweight **Google Review** workflow focused on requesting reviews from eligible customers after a successful interaction or completed service.

The core implementation should intentionally avoid unnecessary Google Business Profile API complexity for v1.

The organization config stores:

- Google review URL.
- Default review-request message/template.
- Optional eligibility delay.
- Optional send-once / cooldown rules.
- Whether the request requires operator approval or can be automated by a configured workflow.

Example message style:

> Aproveitando...\n>\n> Sua avaliação no Google é muito importante para o nosso escritório e ajuda outras pessoas a conhecerem nosso trabalho.\n>\n> Você pode contar brevemente como foi o atendimento, a clareza das orientações e o acompanhamento do seu caso, sem mencionar informações pessoais.\n>\n> Avalie pelo link:\n> {{google_review_url}}

#### Google Review Lite v1 behavior

- Store the review link per organization/location.
- Allow reusable message templates with variables.
- Trigger manually from a contact/conversation.
- Allow workflow-triggered sending after an eligible state/event.
- Prevent accidental repeated requests with a send-history/cooldown guard.
- Record request status in CRM timeline/audit history.
- Make the action available to the agent as a controlled tool only when the workflow/policy allows it.

#### Explicitly not required for v1

- Google Business Profile API authorization.
- Reading reviews back into DeskcommCRM.
- Replying to reviews from DeskcommCRM.
- Review analytics ingestion.
- Detecting whether a specific recipient actually posted a review.

Those capabilities can become a later `Google Review Pro` integration if justified.

---

### 3. CRM AI Copilot

**Status:** locked as a planned core capability; implementation pending.

DeskcommCRM should have a **built-in CRM AI Copilot** for the operator-facing application, separate from the customer-facing autonomous agent.

The Copilot operates against the current tenant's authorized CRM context and should never bypass existing RBAC or tenant isolation.

Expected capabilities:

- Summarize a conversation/contact/account/opportunity.
- Explain what has happened so far and identify the current sales/service state.
- Suggest the next best action.
- Draft a reply for the operator.
- Answer questions over CRM data the current user is authorized to access.
- Surface overdue follow-ups, stalled opportunities and missing information.
- Assist with pipeline updates, notes and task preparation.
- Suggest scheduling actions when booking integration is available.
- Suggest a Google Review request when eligibility rules permit it.

Write actions must remain controlled. The Copilot should distinguish clearly between:

- **read/analyze/suggest** actions, which may run directly within permissions; and
- **mutating actions**, which should require explicit operator confirmation unless a narrowly scoped policy explicitly permits automation.

The Copilot should reuse DeskcommCRM's existing AI-provider/model configuration architecture rather than introducing a separate hidden provider stack.

---

## Product architecture principle

For these three capabilities, DeskcommCRM owns the **CRM experience and business state**, while external services provide narrow infrastructure primitives:

- Google Calendar: availability + calendar event engine.
- Google review URL / optionally Google Business Profile later: review destination.
- Configured LLM provider/model: Copilot reasoning/generation.

This keeps the customer's operational experience inside DeskcommCRM while avoiding rebuilding mature infrastructure unnecessarily.
