# Google Review Lite — v1

Goal: let an operator send a Google review request from Deskcomm without requiring Google Business Profile API access.

Configuration:
- organization-level Google review URL
- organization-level default message template
- default cooldown between requests

Behavior:
- manual send from CRM/contact/conversation context
- validate configured review URL and recipient eligibility
- render template with safe contact/company placeholders
- send through the existing active WhatsApp channel
- record sent status/timestamp/actor
- emit audit event
- prevent accidental duplicate sends within cooldown

Policy:
- no review gating
- no sentiment-based link suppression
- no scraping of Google reviews
- no external write without explicit operator action in v1
