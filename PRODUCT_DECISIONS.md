# Product Decisions

This document records canonical product and architectural decisions for DeskcommCRM that are considered locked unless explicitly revisited through formal product review.

## Summary of Locked Decisions

| Feature / Topic | Status | Architecture & Boundaries |
| :--- | :--- | :--- |
| **GOOGLE REVIEW LITE** | **LOCKED** | Lightweight review request via existing WhatsApp channel; no Google Business Profile API in V1; deduplication & cooldown. |
| **CRM AI COPILOT** | **LOCKED** | Internal AI assistant for CRM operators; reuses AI provider and context stack; read direct, write requires confirmation. |
| **CALENDAR** | **LOCKED** | Google Calendar engine (freebusy & events) + Deskcomm native booking UX (availability rules, slots, CRM linkage). |
| **CAL.COM** | **NOT DEFAULT / FUTURE OPTIONAL ADAPTER** | Not a core dependency for V1; kept as an optional future adapter only if proven necessary. |
| **OMNICHANNEL** | **OUT OF CURRENT SCOPE** | Focused on WhatsApp and existing channel stability; no premature channel sprawl. |
| **LANDING PAGE BUILDER** | **OUT OF CURRENT SCOPE** | External forms/webhooks and native booking slots suffice; no website builder in V1. |

---

## 1. Google Review Lite

- **Status:** **LOCKED / PLANNED**
- **Objective:** Enable the CRM to automatically or manually request a Google review from a customer following a qualifying business event, without requiring Google Business Profile API integration.
- **Core Architecture:**
  - Organization configures its direct Google review link (e.g., `https://g.page/r/.../review`).
  - Organization configures a review request message template with placeholders (`{{google_review_url}}`, `{{nome}}`).
  - Messages are dispatched through the existing connected WhatsApp outbound channel (`send_ledger`, standard anti-ban, opt-out, and before-send guardrails).
- **Triggers & Controls:**
  - Automatic triggers: opportunity marked won (`crm_leads` won) or appointment completed (`calendar_appointments` completed).
  - Manual trigger: operator button in conversation CRM side panel.
  - Controls: enable/disable toggle, custom review URL, template, trigger delays, and cooldown window (e.g., max 1 request every 90 days per contact).
  - Anti-spam: strict deduplication per contact; requests logged to audit trail.
- **Explicit Boundary:** V1 does **not** include Google Business Profile API, reading reviews, review sentiment gating, auto-replying to Google reviews, or review analytics.

---

## 2. CRM AI Copilot

- **Status:** **LOCKED / PLANNED**
- **Objective:** Provide a built-in AI assistant for CRM operators and sales agents, distinct from the customer-facing AI agent.
- **Core Architecture:**
  - Accessible via native CRM UI (persistent assistant drawer/sidebar in Inbox and Kanban).
  - Operates under its own system prompt and purpose (`crm_copilot` in `lib/ai/pontos/registro.ts`), sharing the underlying AI gateway, model catalog, and business context infrastructure.
  - Scoped to authorized tenant data (`contacts`, `conversations`, `crm_leads`, `crm_stages`, `appointments`, `tasks`, `notes`, `memory`).
- **Core Capabilities:**
  - Summarize conversations, leads, and customer relationship history.
  - Identify missing qualification data and suggest next best actions.
  - Analyze objections and surface customer promises or overdue follow-ups.
  - Draft recommended replies directly into the composer.
- **Safety Principle:**
  - **READ** operations execute directly when authorized.
  - **WRITE / MUTATING** actions (moving pipeline stages, creating/rescheduling appointments, sending messages) require explicit human operator confirmation.
  - Customer-facing autonomous agent runtime and internal Copilot runtime remain separate surfaces.

---

## 3. Google Calendar + Native Booking

- **Status:** **LOCKED DIRECTION**
- **Core Architecture:**
  - **Google Calendar = Calendar Engine & Source of Truth:** Manages external events, calendar storage, and `FreeBusy` query time blocks.
  - **Deskcomm = Native Booking Experience & Business Rules:** Manages appointment types, duration, business hours, buffers, minimum notices, slot calculation, contact/lead linkage, and CRM UI.
  - **No Cal.com Dependency:** Deskcomm handles the scheduling UX and availability calculations natively. Cal.com remains a possible future adapter.
- **Core Capabilities:**
  - **CRM Operator:** Check available slots, schedule, reschedule, and cancel appointments directly from contact or opportunity views.
  - **Customer-Facing Agent:** Query real-time available slots via MCP tools (`crm_check_availability`), propose options to leads, and confirm appointments (`crm_create_appointment`).
  - **Availability Engine:** Computes slots using organization working hours (`attendant_availability.schedule`), service duration, buffers, and live Google `FreeBusy` blocks.
  - **Domain Model:** Hybrid model with `calendar_event_types` (molds) and `calendar_appointments` (booked events with Google IDs and CRM foreign keys).

---

## 4. Boundaries & Out-of-Scope Items

- **Cal.com / External Schedulers:** NOT default. Kept as optional future adapters.
- **Omnichannel:** OUT OF CURRENT SCOPE. WhatsApp remains the primary communication channel.
- **Landing Page Builder:** OUT OF CURRENT SCOPE. Native booking UX and webhook form ingestion fulfill acquisition needs.
- **Full Google Business Profile API:** OUT OF CURRENT SCOPE for Review Lite V1.