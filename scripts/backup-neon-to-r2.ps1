# Nightly pg_dump of prod Neon -> Cloudflare R2 — LOCAL FALLBACK for the
# GitHub Actions workflow (.github/workflows/backup-neon.yml) while this
# repo has no remote. Same doctrine: provider-independent backups are
# REQUIRED before real tour data enters the deployment.
#
# Prereqs (never commit these values):
#   - pg_dump 16+ on PATH (PostgreSQL client tools)
#   - aws CLI on PATH (any recent v2)
#   - Environment variables, set machine- or task-scoped:
#       NEON_DIRECT_DATABASE_URL   direct (non "-pooler") Neon URL
#       R2_ACCOUNT_ID              Cloudflare account id
#       R2_ACCESS_KEY_ID           R2 API token key id
#       R2_SECRET_ACCESS_KEY       R2 API token secret
#
# Register as a nightly scheduled task (02:00 local):
#   schtasks /Create /TN "crm-neon-backup" /SC DAILY /ST 02:00 `
#     /TR "powershell -NoProfile -ExecutionPolicy Bypass -File D:\App\crm\scripts\backup-neon-to-r2.ps1"

$ErrorActionPreference = "Stop"

foreach ($name in @("NEON_DIRECT_DATABASE_URL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")) {
  if (-not (Get-Item "env:$name" -ErrorAction SilentlyContinue)) {
    throw "$name is not set - refusing to run a silent no-op backup"
  }
}

$stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
$dumpFile = Join-Path $env:TEMP "crm-$stamp.dump"

pg_dump --format=custom --no-owner --file=$dumpFile $env:NEON_DIRECT_DATABASE_URL
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE)" }

$env:AWS_ACCESS_KEY_ID = $env:R2_ACCESS_KEY_ID
$env:AWS_SECRET_ACCESS_KEY = $env:R2_SECRET_ACCESS_KEY
$env:AWS_DEFAULT_REGION = "auto"
aws s3 cp $dumpFile "s3://crm-db-backups/crm/crm-$stamp.dump" `
  --endpoint-url "https://$($env:R2_ACCOUNT_ID).r2.cloudflarestorage.com"
if ($LASTEXITCODE -ne 0) { throw "R2 upload failed (exit $LASTEXITCODE)" }

Remove-Item $dumpFile -Force
Write-Output "backup complete: crm-$stamp.dump"
