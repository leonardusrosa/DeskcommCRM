# Product Decisions

This file is a lightweight index of product decisions that are considered locked unless explicitly revisited.

Detailed architecture, invariants, scope and reconsideration criteria live in ADRs under [`docs/adr/`](docs/adr/).

## Locked roadmap additions

| Decision | Status | Canonical record |
|---|---|---|
| Google Review Lite | **LOCKED** | [ADR-0002](docs/adr/0002-expansao-crm-agendamento-reviews-copilot.md#d1--google-review-lite-não-depende-da-google-business-profile-api-no-v1) |
| Google Calendar + native Deskcomm booking | **LOCKED** | [ADR-0002](docs/adr/0002-expansao-crm-agendamento-reviews-copilot.md#d2--google-calendar-é-a-engine-de-calendário-deskcomm-é-a-ux-e-a-engine-de-booking) |
| CRM AI Copilot | **LOCKED** | [ADR-0002](docs/adr/0002-expansao-crm-agendamento-reviews-copilot.md#d3--crm-ai-copilot-é-uma-capacidade-operator-facing-distinta-do-agente-que-atende-clientes) |

Current implementation order recommendation:

1. Google Review Lite;
2. Google Calendar + native booking;
3. CRM AI Copilot.

Explicitly out of scope for this locked set: omnichannel expansion, landing-page builder, full Google Business Profile review management, and Cal.com/Calendly as a required core dependency.