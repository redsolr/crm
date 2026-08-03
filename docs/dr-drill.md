# DR drill — destroy, recover, and Neon-branch rehearsal

> **Status: PREPARED, not yet run.** The drill needs the founder at
> the keyboard: the destroy step is irreversible, and the credentials
> (Neon console/API, R2 keys) exist only in the founder's accounts +
> GitHub secrets. Run it **while the pipeline is still fictional** —
> it will never be cheaper (deferred-decisions row 24). Budget ~30–45
> minutes. A Claude session can drive every step; only the
> `DESTROY` line requires the founder's explicit go.

## What the drill proves

1. **Backup restore works under pressure** — a prod wipe is recovered
   from the nightly R2 dump end-to-end (the restore path was proven
   once on 2026-08-02, but never against a destroyed prod).
2. **Neon branching workflow** — branch → schema change → validate →
   merge back, the pattern for future risky migrations.

## Prerequisites (founder)

- Neon console access to project `red-fire-68029213` (or a
  `NEON_API_KEY` for `neonctl`).
- R2 access to bucket `crm-db-backups` (Cloudflare personal acct) —
  or just use GitHub: the dumps are also fetchable via a manual
  `workflow_dispatch` of `backup-neon.yml` + `aws s3 cp` with the R2
  keys.
- `postgresql-client` 16+ locally (`pg_restore`, `psql`) — not
  currently installed on the dev machine.

## Part A — fresh dump first (2 min)

Take a fresh backup so the drill restores TODAY's state, not last
night's:

```
gh workflow run backup-neon.yml --repo redsolr/crm
gh run watch --repo redsolr/crm   # wait for green
```

## Part B — destroy + recover (15 min)

1. Download the newest dump from R2 (S3 API, endpoint
   `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, bucket
   `crm-db-backups`, prefix `crm/`).
2. **DESTROY (founder go required, fictional data only)** — against
   the DIRECT (non `-pooler`) URL:
   ```
   psql "$NEON_DIRECT_DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```
3. Verify the app is actually broken (crm.jurisimus.com shows empty /
   erroring pipeline — screenshot for the log).
4. Recover:
   ```
   pg_restore --clean --if-exists --no-owner -d "$NEON_DIRECT_DATABASE_URL" crm-<stamp>.dump
   ```
5. Verify: pipeline renders, record counts match pre-destroy, a
   spot-check deal's timeline is intact, login works, `/mcp`
   `find_crm_record` returns records.
6. Log the result (time-to-recover, surprises) in this file under
   "Drill log" and close deferred row 24.

## Part C — Neon branch rehearsal (10 min)

1. Console (or `neonctl branches create --name drill`) → branch from
   `main`.
2. Point a LOCAL dev server at the branch URL (`.env.local`
   `DATABASE_URL`, direct form) and apply a harmless schema change
   (e.g. `npm run db:generate` after adding a nullable column to a
   scratch table) — verify migrate-on-deploy tooling behaves against
   a branch.
3. Verify prod (`main` branch) is untouched while the branch diverges.
4. Merge decision: for schema changes Neon branches don't "merge
   back" data — the rehearsal validates the WORKFLOW (test risky DDL
   on a branch first, then run the same migration against main).
   Delete the drill branch after.

## Drill log

| Date | Time to recover | Notes |
| --- | --- | --- |
| _not yet run_ | | |
