# Locked product capabilities

Status: product direction locked

## Google Calendar + native booking

Deskcomm owns the booking UX and business rules. Google Calendar is the primary calendar engine/sync layer.

V1 scope:
- Connect one or more Google calendars per organization.
- Configure services, duration, buffers, working hours, timezone and booking horizon.
- Compute free slots from Deskcomm rules + Google Calendar busy periods.
- Create, reschedule and cancel appointments from Deskcomm.
- Show appointments inside CRM/contact context.
- Expose booking actions to the AI agent and operator UI with explicit ownership/audit rules.
- Keep the architecture provider-abstracted so another calendar backend can be added later.

Non-goal for v1: depend on Cal.com/Calendly. Add one only if a concrete implementation blocker is proven.

## Google Review Lite

Native review-request workflow using a configured Google review URL. V1 does not require Google Business Profile API access.

V1 scope:
- Store organization review URL and default request template.
- Eligibility/status per contact/conversation.
- Send request manually from CRM and make the action available to automations/agent tools under explicit policy.
- Record sent timestamp, actor, channel and audit event.
- Avoid repeated/spam requests through cooldown/idempotency rules.
- Do not scrape, gate or condition the Google review link on review sentiment.

## CRM AI Copilot

Built-in operator copilot grounded in CRM context.

V1 scope:
- Read contact, recent conversation, opportunity/funnel state and relevant CRM notes/memory.
- Summarize the account/conversation.
- Suggest next action.
- Draft a reply.
- Answer operator questions about the current CRM context.
- Keep external/customer-facing writes behind explicit operator confirmation in v1.
- Reuse the existing provider/model configuration and AI cost/audit infrastructure instead of introducing a separate hidden provider stack.

## Explicit exclusions

- Omnichannel expansion.
- Landing-page builder.
