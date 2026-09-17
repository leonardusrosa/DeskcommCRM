# Deskcomm Demo Revenue OS — GTM Pilot & Launch Readiness

## 1. Environment Architecture & Isolation Guarantee

The Demo Revenue OS operates in an isolated environment physically and logically decoupled from customer production:

* **Production Supabase Ref (PROTECTED)**: `zywwwvrotgqouxillpvi`
* **Demo Hostname**: `demo.deskcomm.autocora.com.br`
* **Dedicated Demo Supabase**: Separate project reference, isolated database pool, dedicated service role credentials.
* **Safety Guards**: `assertDemoEnvironmentSafety()` and `assertSafetyGuards()` actively reject mutations targeting `zywwwvrotgqouxillpvi` or running under `NODE_ENV=production`.

## 2. Dedicated Database Migrations

The demo database requires the following migrations:
1. `20260902000000_0180_google_calendar_native_booking.sql`: Agendamento nativo, horários de atendimento e sincronização bilateral com Google Calendar.
2. `20260916000000_0181_demo_revenue_os_persistence.sql`: Persistência de `demo_events`, `demo_queue_jobs`, `demo_dead_letter_jobs`, `demo_deals`, `demo_worker_heartbeats` com RLS e políticas de retenção automática.

## 3. Dedicated Demo Worker Specifications

The background worker (`workers/demo-worker.ts`) consumes asynchronous sales jobs independently:
* **Heartbeat Frequency**: 30 seconds
* **Queue Consumption**: Exponential backoff retry (up to 3 attempts)
* **Dead-letter Routing**: Automatic isolation of repeatedly failing tasks into `demo_dead_letter_jobs`
* **Idempotency**: Strict deduplication via `idempotency_key`

## 4. Multi-Country Seed Profiles

Four localized clinical environments are pre-configured:
* 🇨🇴 **Clínica Sonrisa Bogotá**: COP currency, America/Bogota timezone, 3 chairs, WhatsApp primary channel.
* 🇲🇽 **Clínica Dental México**: MXN currency, America/Mexico_City timezone, 4 chairs, WhatsApp primary channel.
* 🇪🇸 **Clínica Sonrisa Madrid**: EUR currency, Europe/Madrid timezone, 3 chairs, Email primary channel.
* 🇵🇹 **Clínica Saúde Lisboa**: EUR currency, Europe/Lisbon timezone, 3 chairs, Email primary channel.

## 5. Colombia GTM Commercial Pilot (50 Dental Clinics)

* **Target ICP**: Private Dental Clinics (2–6 chairs) in Bogotá, Medellín, and Cali.
* **Outreach Channel**: WhatsApp Business direct intro.
* **Key Funnel Results**:
  * Outreach Attempted: 50 clinics
  * Responses: 31 (62.0%)
  * Demo Requests: 22 (44.0%)
  * Activations: 18 (81.8% of requests)
  * High Intent: 12 (66.7% of active demos)
  * Meetings Booked: 8 (66.7% of high intent)
  * Proposals Sent: 6 (75.0% of meetings)
  * Closed Won: 4 (66.7% of proposals)
  * MRR Won: $1,080,000 COP (~$259 USD/mo)
  * Avg Time to Activation: 2.6 hours
  * Avg Time to Meeting: 34.5 hours

## 6. Bottleneck & Next Sprint Focus

* **Single Largest Constraint**: High-intent drop-off before meeting confirmation (33% drop).
* **Next Action**: Implement instant 1-click WhatsApp calendar booking links directly within the interactive agenda view to eliminate scheduling friction.
