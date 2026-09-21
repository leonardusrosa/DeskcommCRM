# DeskcommCRM Roadmap

This document records product directions that are considered **locked** at the strategy level but are not necessarily implemented yet.

## Locked: Google Review Lite

Goal: support post-service Google review requests without making Google Business Profile API integration a dependency for v1.

### v1 scope

- Per-organization configurable direct Google review URL, e.g. a `g.page/.../review` link.
- CRM-native action/automation that sends the review request through the currently connected messaging channel.
- Editable message template with supported CRM variables.
- Trigger options based on CRM state, such as service/opportunity completion, stage change, manual action, or delayed follow-up.
- Internal send history/status to reduce accidental duplicate requests.
- No Google Business Profile OAuth/API required for v1.
- No scraping or automated verification that the customer actually published a review in v1.

Target flow:

```text
service completed
  -> configured delay / trigger
  -> send review request with direct Google review link
  -> record event in CRM
```

A future full Google Business Profile integration may add richer review management, but it is outside the Lite scope.

---

## Locked: Built-in CRM AI Copilot

Goal: provide an internal AI assistant for Deskcomm operators/admins, separate from the customer-facing agent.

### Intended MVP capabilities

- Ask questions about contacts, conversations, opportunities, pipeline, and CRM history using tenant-scoped data.
- Summarize a contact, conversation, or opportunity.
- Draft operator replies and follow-ups.
- Suggest next actions and identify qualification gaps.
- Surface stale opportunities and follow-up candidates.
- Explain CRM state when supported by stored evidence.

### Architecture direction

- Strict organization/tenant isolation.
- Reuse the existing AI provider/model/cost infrastructure where practical.
- Prefer a read-only MVP before mutating CRM tools are enabled.
- Customer-facing agent and internal copilot remain distinct roles/runtime contexts.
- Future write actions should use explicit tools and confirmation/authorization appropriate to the action.

---

## Locked: Google Calendar + Native Deskcomm Booking

Decision: use **Google Calendar as the external calendar engine/source of truth for availability and events**, while Deskcomm provides the **native booking experience, scheduling rules, CRM linkage, and AI/operator tools**.

Do not make Cal.com/Calendly a required dependency for the initial implementation. They may be optional providers later if there is product demand.

### What "native booking" means

The customer/operator should interact with Deskcomm, not with a separate scheduling product. Deskcomm reads Google Calendar availability and writes the resulting event back to Google Calendar.

Target flow:

```text
CRM / AI conversation
  -> identify service + scheduling intent
  -> Deskcomm calculates available slots from native rules + Google Calendar busy time
  -> Deskcomm offers the slots in chat or booking UI
  -> customer chooses a slot
  -> Deskcomm creates the Google Calendar event
  -> Deskcomm stores appointment/CRM linkage and status
  -> reminders, reschedule, cancellation, and follow-up use the same booking record
```

### Native Deskcomm booking surfaces

- Calendar/agenda view inside Deskcomm.
- Appointment entity linked to contact and, where relevant, opportunity, service, and responsible user/agent.
- Native availability rules: working hours, appointment duration, buffers, lead time, blackout dates, and timezone.
- Google Calendar free/busy lookup for connected calendars.
- Create/update/cancel Google Calendar events.
- Deskcomm-hosted booking page/link for customer self-scheduling.
- Manual operator scheduling from the CRM.
- AI tools such as:
  - `check_availability`
  - `book_appointment`
  - `reschedule_appointment`
  - `cancel_appointment`
- Appointment history/status and audit trail.
- Reminder and follow-up hooks using Deskcomm automation infrastructure.

### Source-of-truth split

Google Calendar should remain the source of truth for external calendar events/busy synchronization.

Deskcomm should remain the source of truth for CRM-specific scheduling metadata, including contact/opportunity/service linkage, booking status, automation history, and customer workflow state.

### Integration direction

- Google Calendar OAuth connection per organization and/or responsible user as required by the final scheduling model.
- Avoid introducing a Cal.com/Calendly service solely to obtain booking UI or slot computation if Deskcomm can implement those natively.
- Optional additional calendar/booking providers can be abstracted later behind the same scheduling domain.

---

## Explicitly separate / not part of these locked items

- Omnichannel expansion.
- Landing-page builder.

These remain separate product concerns and are not prerequisites for Google Review Lite, CRM AI Copilot, or Google Calendar/native booking.
