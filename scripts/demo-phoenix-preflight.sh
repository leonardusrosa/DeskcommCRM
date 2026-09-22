#!/usr/bin/env bash
set -euo pipefail

echo "== Phoenix demo preflight (read-only) =="
echo
echo "-- host --"
hostname || true
uname -a || true

echo
echo "-- memory --"
free -h || true

echo
echo "-- disk --"
df -h / || true
docker system df || true

echo
echo "-- compose projects --"
docker compose ls || true

echo
echo "-- running containers --"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' || true

echo
echo "-- container memory now --"
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}' || true

echo
echo "-- listeners relevant to demo/proxy/supabase --"
if command -v ss >/dev/null 2>&1; then
  ss -ltnp | grep -E ':(80|443|3300|54320|54321|54322|54323|54324)\\b' || true
else
  echo "ss not installed"
fi

echo
echo "-- docker networks --"
docker network ls || true

echo
echo "-- likely reverse proxies --"
docker ps --format '{{.Names}} {{.Image}}' | grep -Ei 'caddy|traefik|nginx|haproxy|coolify|dokploy' || true

echo
echo "Preflight complete. No containers, networks, files, or firewall rules were changed."
