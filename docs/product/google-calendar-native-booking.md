# Google Calendar + native booking — v1

Deskcomm owns the scheduling UX and rules. Google Calendar is the primary calendar engine/sync layer.

Core model:
- connection: Google account/calendar IDs per organization
- service: name, duration, buffers, active flag
- availability rule: timezone, weekdays, opening windows, booking horizon, minimum notice
- appointment: contact, service, start/end, status, Google event ID, source, notes

User experience:
- CRM shows available times directly
- operator or AI can propose slots
- booking confirmation creates the appointment and corresponding Google Calendar event
- reschedule/cancel stays synchronized
- no Cal.com/Calendly dependency in v1

Provider boundary:
- implement a calendar provider interface so Google can be replaced/augmented later without changing booking domain logic
