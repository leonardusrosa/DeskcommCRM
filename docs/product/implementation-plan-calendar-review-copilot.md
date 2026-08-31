# Implementation plan — calendar, review lite and CRM copilot

This plan is intentionally staged so each capability can be reviewed and deployed independently.

## Phase 1 — Google Review Lite

Smallest production-safe slice:
1. Organization settings for `google_review_url` and default review-request template.
2. Contact-level review request status/cooldown metadata.
3. Server action/API to validate eligibility and enqueue/send through the existing WhatsApp channel.
4. Manual CRM UI action.
5. Audit event and tests.

## Phase 2 — Google Calendar + native booking

1. Calendar provider abstraction.
2. Google OAuth connection per organization.
3. Booking service/rule schema.
4. Availability engine: Deskcomm hours/buffers/horizon + Google free/busy.
5. Appointment create/reschedule/cancel.
6. CRM calendar/appointment UI.
7. Agent tools for availability and booking, with explicit confirmation for writes.
8. Audit, idempotency and tests.

## Phase 3 — CRM AI Copilot

1. Copilot context builder from contact/conversation/opportunity/memory.
2. Read-only copilot endpoint.
3. UI panel in CRM/conversation view.
4. Capabilities: summary, next-action suggestion, draft reply, contextual Q&A.
5. Reuse existing model/provider/cost tracking infrastructure.
6. No automatic customer-facing writes in v1.

## Delivery rule

Do not merge/deploy all three as a single high-risk change. Implement behind separate commits/PRs or clearly separable slices, starting with Review Lite because it has the smallest external-integration surface.
