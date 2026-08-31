# Product Decisions

This file records product decisions that are considered locked unless explicitly revisited.

## Locked roadmap additions

### Google Review Lite

Status: **LOCKED**

Goal: add a lightweight review-request workflow without requiring Google Business Profile API integration for v1.

Scope:
- Per-organization Google review URL.
- Reusable review request message template.
- Manual send from CRM and future lifecycle/status trigger support.
- Track request send state in the CRM/audit trail.
- No review gating, no sentiment-based filtering, and no suppression based on expected rating.
- No Google Business Profile API dependency in v1.

Example message pattern:

> Aproveitando...
>
> Sua avaliação no Google é muito importante para o nosso escritório e ajuda outras pessoas a conhecerem nosso trabalho.
>
> Você pode contar brevemente como foi o atendimento, a clareza das orientações e o acompanhamento do seu caso, sem mencionar informações pessoais.
>
> Avalie pelo link:
> {{google_review_url}}

### CRM AI Copilot

Status: **LOCKED**

Goal: provide a built-in AI copilot for CRM operators.

Target capabilities:
- Summarize the current conversation/contact.
- Surface relevant CRM memory, lead stage, open opportunity, promises, and follow-ups.
- Suggest the next best action.
- Draft replies for operator approval.
- Explain why a lead is in its current stage and what is missing to advance.
- Search/query CRM records within the current organization scope.
- Never send messages or mutate CRM state without explicit operator action unless a future separately-authorized automation mode is introduced.

This is a core CRM capability, not a provider-specific add-on.

### Native booking powered by Google Calendar

Status: **LOCKED**

Decision: do **not** make Cal.com or Calendly a required dependency for the first implementation if native booking can be built directly on Google Calendar.

Google Calendar is the first-class calendar engine/source of truth. Deskcomm owns the booking UX and booking rules.

Target behavior:
- Organization connects one or more Google Calendars.
- Deskcomm stores booking configuration such as:
  - appointment/service types;
  - duration;
  - buffers before/after;
  - business hours;
  - minimum notice;
  - maximum advance booking window;
  - timezone;
  - assigned calendars/users;
  - cancellation/reschedule policy.
- Deskcomm queries Google Calendar free/busy and computes available slots.
- AI agent can offer available slots directly in WhatsApp/chat.
- Operator can view availability and create appointments from the CRM.
- Booking creates, updates, and cancels Google Calendar events while storing linked appointment metadata in Deskcomm.
- Contact/opportunity timeline shows appointment lifecycle.
- Reminder/follow-up automation hooks should be possible later.
- Prevent double booking and correctly handle timezone/DST.
- A native booking page/widget can later consume the same internal availability/booking API.

Architecture should keep the calendar provider behind an adapter so a future Cal.com integration can be added without making Cal.com a core dependency.

## Out of scope for these decisions

- Omnichannel expansion.
- Landing-page builder.
- Full Google Business Profile API / review analytics for Google Review Lite v1.
- Cal.com/Calendly deployment unless later technical evidence shows native booking is materially worse than an adapter-based external scheduler.
