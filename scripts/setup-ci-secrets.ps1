# One-shot CI enablement for redsolr/crm — run from the repo root in a
# shell where `gh` is authenticated with ADMIN on the repo (redsolr, or
# a collaborator with admin):
#
#   powershell -ExecutionPolicy Bypass -File scripts/setup-ci-secrets.ps1
#
# Reads the 8 real-auth secrets straight out of .env.local, pushes them
# as repo secrets, and flips RUN_REAL_AUTH_E2E=true so the ci.yml
# real-auth job (real WorkOS login + Postgres + realtime worker) starts
# running on every push/PR.
#
# Backups (backup-neon.yml) need three MORE values this script can NOT
# derive — add them the same way once R2 is enabled in the Cloudflare
# dashboard (R2 -> enable, then Manage R2 API Tokens -> create):
#   gh secret set NEON_DIRECT_DATABASE_URL --repo redsolr/crm   # Neon console, non -pooler URL
#   gh secret set R2_ACCOUNT_ID            --repo redsolr/crm   # 6609e73dee4dd7de2ee8aa67ea363a80
#   gh secret set R2_ACCESS_KEY_ID         --repo redsolr/crm
#   gh secret set R2_SECRET_ACCESS_KEY     --repo redsolr/crm
#   npx wrangler r2 bucket create crm-db-backups   (from realtime/)

$ErrorActionPreference = "Stop"
$repo = "redsolr/crm"
$envFile = Join-Path $PSScriptRoot "..\.env.local"
if (-not (Test-Path $envFile)) { throw ".env.local not found next to scripts/" }

$keys = @(
  "WORKOS_API_KEY", "WORKOS_CLIENT_ID", "WORKOS_COOKIE_PASSWORD",
  "E2E_WORKOS_EMAIL", "E2E_WORKOS_PASSWORD",
  "E2E_WORKOS_TEAMMATE_EMAIL", "E2E_WORKOS_TEAMMATE_PASSWORD",
  "CRM_MCP_TOKEN"
)

$lines = Get-Content $envFile
foreach ($key in $keys) {
  $line = $lines | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if ($null -eq $line) { throw "$key missing from .env.local" }
  $value = $line.Substring($key.Length + 1).Trim()
  $value | gh secret set $key --repo $repo
  Write-Output "secret set: $key"
}

gh variable set RUN_REAL_AUTH_E2E --body "true" --repo $repo
Write-Output "variable set: RUN_REAL_AUTH_E2E=true"
Write-Output "Done - the real-auth CI job runs on the next push."
