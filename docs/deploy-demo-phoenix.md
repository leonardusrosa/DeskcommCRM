# Phoenix isolated demo deployment

This runbook deploys the synthetic dental demo beside the existing Deskcomm
installation without sharing its Supabase project, Redis, WAHA sessions, Docker
volumes, or Compose project.

## Safety invariants

- Production Supabase ref `zywwwvrotgqouxillpvi` must never appear in `.env.demo`.
- Do not reuse `prospector-crm` as the demo database.
- Keep production `DEMO_PROVISIONING_ENABLED=false`.
- The demo Compose project is `deskcomm-demo`.
- The demo does not start WAHA or the agent worker.
- Synthetic sends remain local dry-runs.
- Redis is isolated inside the demo network.
- Only the app joins the proxy network.
- Do not start a second Caddy/Traefik on ports 80/443.

## 1. Inspect Phoenix first

From a checkout of this repository on Phoenix:

```bash
bash scripts/demo-phoenix-preflight.sh
```

The script is read-only. Save its output before deciding whether Phoenix also
has enough headroom to self-host Supabase.

## 2. Dedicated Supabase

A separate Supabase database/auth stack is mandatory.

### Phoenix preflight decision — 2026-09-21

The live Phoenix host was measured before deployment:

- ARM64 / Ubuntu 24.04
- root filesystem: 177 GB / 193 GB used (92%; ~17 GB free)
- RAM: 11 GiB total, ~5.5 GiB available
- swap: 6.1 GiB / 8 GiB already in use
- one Deskcomm Supabase stack already occupies the standard local ports
- another independent Supabase stack (`automais_supabase`) is also running

**Decision: do not self-host another Supabase stack on Phoenix in this state.**

A third Supabase stack would add several database/auth/API containers, duplicate
large images, require non-default port mapping, and reduce both disk and memory
safety margin on the same machine that hosts production.

Use a dedicated external NON-PRODUCTION Supabase project instead.

For this demo the isolated project is:

- project ref: `kkbbqwhkkborpugmiqqq`
- project URL: `https://kkbbqwhkkborpugmiqqq.supabase.co`
- Auth Site URL: `https://demo.deskcomm.autocora.com.br`
- Auth redirect: `https://demo.deskcomm.autocora.com.br/auth/confirm` The currently
connected free Supabase account is already at its two-active-project limit, so
create the demo project under a separate Supabase account/free allowance (or a
paid slot if deliberately chosen later).

Do **not** point the demo at production, `prospector-crm`, the existing local
Deskcomm Supabase, or `automais_supabase`.

For a fresh Supabase project, Deskcomm's canonical fresh-install schema is
`supabase/baseline.sql`; do not replay the historical migration chain from
zero.

Example with a privileged database URL:

```bash
psql "$SUPABASE_DB_ADMIN_URL" -v ON_ERROR_STOP=1 -f supabase/baseline.sql
```

Then verify the demo capacity RPC exists and is service-role only.

## 3. Create the demo environment

```bash
cp .env.demo.example .env.demo
chmod 600 .env.demo
```

Generate independent demo secrets, for example:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -base64 32
```

Fill every `CHANGE_ME` and set the real demo hostname in:

- `DEMO_DOMAIN`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_ADMIN_URL`

The Redis REST token must match:

```text
SRH_TOKEN == UPSTASH_REDIS_REST_TOKEN
```

## 4. Verify the Easypanel attachment and image architecture

Phoenix uses Easypanel Traefik 3.6.7 on the external overlay network
`easypanel`, with entrypoints `http`/`https` and resolver `letsencrypt`.

Before creating a demo container, verify the overlay accepts standalone
containers and that the app image can run on this ARM64 host:

```bash
docker network inspect easypanel \
  --format 'driver={{.Driver}} scope={{.Scope}} attachable={{.Attachable}}'

docker buildx imagetools inspect ghcr.io/leonardusrosa/deskcommcrm:latest
```

Do not continue unless either:

- the image manifest includes `linux/arm64`; or
- the host's already-proven deployment path explicitly runs the amd64 image via
  configured emulation.

The current repository image workflow declares `linux/amd64`, so ARM64
compatibility must be proven rather than assumed.

The `easypanel` network must report `attachable=true` for this standalone
Compose design. If it is not attachable, use a Swarm service/Easypanel-managed
service instead of weakening network isolation.

## 5. Start only the isolated demo stack

Once those two checks pass:

```bash
docker compose --env-file .env.demo -f docker-compose.demo.yml pull
docker compose --env-file .env.demo -f docker-compose.demo.yml up -d
docker compose --env-file .env.demo -f docker-compose.demo.yml ps
```

The app is additionally bound to loopback for host-local smoke testing:

```bash
curl -fsS http://127.0.0.1:3300/api/demo/catalog
```

Expected: HTTP 200, four market templates, and `provisioningEnabled: true`.

## 6. Route through the existing Easypanel Traefik

Do not start another proxy and do not modify ports 80/443.

Copy the supplied dynamic configuration template:

```bash
sudo cp infra/easypanel/deskcomm-demo.yml.example \
  /etc/easypanel/traefik/config/deskcomm-demo.yml
```

Replace `demo.deskcomm.autocora.com.br` in that copied file with the real demo hostname.
The template declares:

- HTTP router on entrypoint `http` with HTTPS redirect;
- HTTPS router on entrypoint `https`;
- ACME resolver `letsencrypt`;
- service target `http://deskcomm-demo-app:3000`.

Because Traefik and the demo app share the existing `easypanel` overlay, that
service name resolves inside the proxy network without exposing port 3000 to the
internet. The `127.0.0.1:3300` mapping remains host-local only.

## 7. Public smoke test

After DNS/HTTPS resolves:

```bash
curl -fsS https://demo.deskcomm.autocora.com.br/api/demo/catalog
```

Then verify in a browser:

- `/demo`
- `/demo/catalog`
- one provisioning each for CO, MX, ES, PT
- temporary login
- Inbox, CRM, Agenda
- dry-run outbound send
- synthetic QR/reconnect = 409
- expiry cleanup

## Rollback

The demo stack is independent:

```bash
docker compose --env-file .env.demo -f docker-compose.demo.yml down
```

This does not stop the production Deskcomm Compose project.

If Caddy was attached to `deskcomm-demo-proxy`, remove only that attachment
after removing the demo hostname:

```bash
docker network disconnect deskcomm-demo-proxy <existing-caddy-container>
```
