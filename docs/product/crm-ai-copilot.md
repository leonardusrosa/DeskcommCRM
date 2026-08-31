# CRM AI Copilot — v1

Operator-facing AI assistant embedded in CRM/conversation context.

Grounding:
- contact profile
- recent conversation
- current opportunity/funnel state
- CRM notes/memory relevant to the active contact

V1 actions:
- summarize context
- suggest next action
- draft reply
- answer operator questions

Safety/ownership:
- read/draft/suggest by default
- no customer-facing send or destructive CRM mutation without explicit operator confirmation
- reuse existing provider/model, usage/cost and audit infrastructure
