# CRM Growth Pack — Implementation Plan

Companion to `docs/product/crm-growth-pack.md`.

## Phase 1 — Google Calendar + native booking

### Slice 1: foundation
- inspect existing integrations/OAuth/calendar abstractions;
- define persistence for calendar connection, booking settings and appointment linkage;
- Google OAuth connection per organization/user as appropriate;
- free/busy adapter;
- deterministic timezone-safe slot generator;
- read-only availability endpoint;
- no agent behavior change yet.

### Slice 2: booking mutations
- create appointment;
- reschedule appointment;
- cancel appointment;
- idempotency and event mapping;
- audit events;
- CRM linkage.

### Slice 3: native CRM UI
- booking settings;
- availability viewer;
- create/reschedule/cancel from contact/conversation/opportunity;
- appointment timeline/status.

### Slice 4: agent tools
- availability lookup;
- offer a bounded set of real slots;
- book only after explicit customer confirmation;
- reschedule/cancel with confirmation;
- handoff-safe behavior;
- tool/audit/cost observability.

### Slice 5: reminders and follow-up hooks
- upcoming appointment reminder;
- post-appointment lifecycle event;
- hook usable by Google Review Lite.

## Phase 2 — Google Review Lite

- organization review URL + message template;
- eligibility state and manual send;
- configurable trigger after lifecycle events;
- delay/cooldown/dedup;
- do-not-request flag;
- scheduled/sent/skipped/failed statuses;
- audit events;
- use existing WhatsApp transport only;
- no Google Business Profile API required in v1.

## Phase 3 — CRM AI Copilot

- separate operator-only copilot surface;
- context assembler for contact/conversation/opportunity/memories;
- summarize;
- answer CRM-context questions;
- suggest next best action;
- draft reply without auto-send;
- surface stale leads/follow-up gaps;
- later: structured CRM mutations behind explicit confirmation;
- reuse existing provider/AI-point architecture;
- provider/model/purpose cost observability.

## Cross-cutting constraints

- tenant isolation;
- explicit RBAC;
- auditability;
- no secrets in browser/audit metadata;
- fail closed on provider/integration errors;
- idempotent external mutations;
- no default behavior changes to existing agents until feature is configured;
- migrations must be additive and reversible where practical;
- E2E with a test calendar before production activation.
