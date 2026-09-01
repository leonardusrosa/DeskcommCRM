# Locked CRM capabilities — product decisions

Status: **LOCKED**

This document is the source of truth for three additions to DeskcommCRM. GitHub Issues are disabled in this repository, so the decisions are kept in-tree and reviewed with the implementation.

## 1. Google Review Lite

### Product decision
Use the customer's direct Google review URL. Do **not** make Google Business Profile API a dependency of v1.

### v1 behavior
- Tenant config stores:
  - enabled/disabled
  - direct HTTPS review URL
  - request-message template
- The operator gets an action in the Inbox that **fills the composer** with the configured request.
- The human can edit and explicitly send it through the existing channel.
- No review gating: do not ask only satisfied customers.
- Do not generate review content on the customer's behalf.
- No Google credentials are required for this feature.

### Later
- Optional post-service automation, only after channel/template/compliance rules are modeled explicitly.
- Google Business Profile synchronization/replying is a separate feature and not required for Review Lite.

## 2. CRM AI Copilot

### Product decision
The Copilot is built into the operator CRM and is **human-in-the-loop / read-only by default**.

### Existing primitive
DeskcommCRM already has `Sugerir resposta` in the Inbox. It uses the published agent plus real lead/conversation context and returns a draft without sending it.

This is the first Copilot capability and should be extended, not replaced by a parallel assistant runtime.

### Target capabilities
- conversation/customer summary
- suggested next action
- draft reply
- answer operator questions using CRM/conversation/opportunity context
- surface relevant opportunity/funnel facts

### Safety boundary for v1
Copilot may read and recommend. CRM writes, sends and scheduling mutations require an explicit human action/confirmation unless a future, separately designed permission model says otherwise.

## 3. Native booking with Google Calendar

### Product decision
Do **not** add Cal.com to v1.

Architecture:

```text
DeskcommCRM UI + agent tools
        |
        v
Native booking layer
        |
        v
Google Calendar
(source of availability/events)
```

The user experiences scheduling inside DeskcommCRM. Google Calendar is the external engine/source of truth.

### Target flow
1. Admin connects a Google account/calendar.
2. Deskcomm reads busy intervals and applies tenant booking rules.
3. CRM/operator/agent can offer real available slots.
4. Human/customer selects a slot.
5. Deskcomm creates the Google Calendar event and records the booking association locally.
6. Reschedule/cancel operations update the same external event.

### Tenant booking rules
Foundation config includes:
- provider = `google_calendar`
- default slot duration
- buffer between appointments
- booking horizon

Working hours, timezone policy, calendar selection and event metadata are finalized with the OAuth/runtime implementation.

### Credential boundary
OAuth access/refresh tokens MUST NOT be stored in `organizations.settings`. Use a dedicated encrypted connection/credential record with tenant scope, token refresh and revocation handling.

### When Cal.com becomes justified
Only revisit Cal.com if requirements grow into resource/team routing, multiple host pools, advanced round-robin scheduling, complex booking forms/workflows or cross-calendar scheduling that would otherwise duplicate a booking platform.

## Delivery split

### GitHub-only foundation
- typed tenant config for Review Lite, Copilot boundary and booking defaults
- admin UI under Organization settings
- tenant-scoped GET/PATCH API
- Review Lite composer action component, human-in-the-loop
- unit tests for config invariants

### CLI/runtime phase
- wire Review Lite action into the existing large Composer safely and run UI tests
- Google OAuth app/callback/token encryption/storage
- Google Calendar free/busy + event CRUD
- native booking UI and agent tools
- local booking association/schema if needed
- expand Copilot with summary/next-action/query UI using the existing agent/runtime
- end-to-end, typecheck, lint and production-safe migration review
