# Isolated BillDesk UAT deployment handoff

Prepared locally; no remote changes or SQL execution authorized by this document.

## Latest verified state (16 October 2026)

- Authenticated Vercel dashboard: team `team_hmLuQaGn92bbNIQoBJpiwdRR`, existing starter project `prj_jkl9eVo4ZmcuufuXRBOEtM8WrscS` (`pice-and-soul-uat`). Its stable domain is `pice-and-soul-uat.vercel.app`; it serves starter repository `hakeemrestro-ctrl/pice-and-soul-uat`, branch `main`, commit `807afcb749cfa6e06f045a64b5be70d31d08bc26`. It is NOT the original application. No settings were changed.
- If separately approved for reuse, its eventual application URLs would be `https://pice-and-soul-uat.vercel.app/api/billdesk/callback` and `https://pice-and-soul-uat.vercel.app/api/billdesk/webhook`. They are not verified BillDesk endpoints or registered URLs today. A newly created project would use its own assigned hostname instead.
- Authenticated Supabase dashboard confirms `spice-and-soul-uat` at `alytmroxgxmybvjgevhn`. Migration history UI shows no recorded migrations. Functions from 0018-0021 are visible; `billdesk_record_raw_audit` has the three expected named text arguments, returns void, and is SECURITY DEFINER. Owner, search_path, effective grants and full installed definition still require the prepared metadata queries. No SQL was executed.
- Supabase connector still lists only unrelated projects. Browser access is available; no CLI/database access token or direct database URL was found in the process environment. No adapter SSH connection was established, so runtime egress remains unverified.
- New local UAT guards block the shared Resend client and both email cron routes when `BILLDESK_ENV=UAT`. Cron authentication now fails closed when its secret is missing. The production-domain canonical redirect is omitted for UAT; non-UAT configuration remains unchanged. Tests use synthetic fixtures only. Supabase-managed email settings still need independent verification.
- Email fulfillment is intentionally unavailable in UAT until an approved test transport is implemented. The app does not pretend blocked delivery succeeded. No production mail API key should be copied to the new deployment.

## Source and deployment target

- Source: `hakeemrestro-ctrl/spice-and-soul`, branch `uat`, repository root `./`.
- GitHub read-only check found no remote `uat` branch on 16 October 2026.
- The 13 pending BillDesk files need an explicitly approved commit. Push is a separate approval: first check whether the existing production Vercel project automatically creates preview deployments for new branches.
- Do not copy the lightweight `pice-and-soul-uat` v0 starter into this application.
- Identify the intended UAT Vercel team ID and project ID. Either approve reconnecting the starter UAT project to the original repository or approve a separate project; do not change the production project.
- Framework Next.js; root `./`; Node 24.x; build `pnpm run build`; install using the existing lockfile with `pnpm install --frozen-lockfile`. Confirm the pnpm version against the existing installation before remote configuration; do not upgrade dependencies.
- Set the separate UAT project's Production environment branch tracking to `uat`. Do not finish an import that automatically deploys `main`.
- Use only the assigned stable `vercel.app` domain. Record its actual hostname; none is verified yet. Do not attach `hakeemrestro.shop`.
- Inspect shared/team environment variables and integrations to prevent production credentials being inherited. Scope UAT secrets only to the intended UAT environment.
- Before deployment approve email/cron isolation and verify the UAT database. After deployment verify source SHA, branch, project/team, domain, environment and Supabase association.

## Required app configuration (names only for credentials)

| Variables | UAT setting |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://alytmroxgxmybvjgevhn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Matching UAT project credentials only |
| `NEXT_PUBLIC_APP_URL`, `BILLDESK_UAT_APP_ORIGIN` | Actual assigned stable HTTPS UAT origin, no trailing slash |
| `BILLDESK_ENV` | `UAT` |
| `BILLDESK_MERCID`, `BILLDESK_CLIENT_ID`, `BILLDESK_KEY_ID`, `BILLDESK_JWE_PASSWORD`, `BILLDESK_JWS_PASSWORD` | Merchant-issued UAT values only |
| `BILLDESK_KEY_ENCODING`, `BILLDESK_JWS_ALGORITHM`, `BILLDESK_TIMESTAMP_FORMAT` | Current implementation: `utf8`, `HS256`, `ist-calendar`; merchant confirmation required |
| `BILLDESK_UAT_TESTER_IDS` | Approved UAT Auth user IDs; never production users |
| `BILLDESK_DEVICE_MAC_POLICY` | `omit-confirmed` only if merchant confirms omission |
| `BILLDESK_UAT_HOSTED_URL`, `BILLDESK_UAT_HOSTED_FIELDS` | Merchant-approved exact hosted endpoint and field set |
| `BILLDESK_ADAPTER_URL`, `BILLDESK_ADAPTER_AUTH_KEY_ID`, `BILLDESK_ADAPTER_AUTH_SECRET` | Isolated adapter endpoint and matching UAT-only authentication |
| `BILLDESK_UPSTREAM_ENABLED` | `false`; separate explicit approval needed to enable |
| `VERCEL` | Platform-injected; do not simulate trusted ingress |
| `RESEND_API_KEY` | Required for email fulfillment, blocked until test-only delivery is enforced |

Optional: `NEXT_PUBLIC_BILLDESK_ENABLED` (UI only, keep false initially), `UNSPLASH_ACCESS_KEY`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`. `CRON_SECRET` and `ADMIN_DIGEST_EMAIL` require an approved cron/email plan; do not assume omission disables the routes safely. Do not copy production provider credentials. Keep `NEXT_PUBLIC_PAYGLOCAL_ENABLED` disabled in UAT; hiding a UI is not endpoint authorization.

Production BillDesk variables are not needed: `BILLDESK_APP_ORIGIN`, `BILLDESK_CHECKOUT_BINDING_SECRET`, `BILLDESK_CUSTOMER_CHECKOUT_ENABLED`, `BILLDESK_HOSTED_URL`, `BILLDESK_HOSTED_FIELDS`.

## Routing, adapter and external approvals

- Register `https://<actual-stable-uat-host>/api/billdesk/callback` and `https://<actual-stable-uat-host>/api/billdesk/webhook`. Do not register a guessed hostname or the adapter URL. Ensure deployment protection permits delivery while retaining signature validation.
- Set UAT Supabase Auth site/redirect URLs to the UAT host only after separate approval; verify tester authentication.
- App callback displays bound database status only; webhook Retrieve remains authoritative for fulfillment.
- Adapter needs `BILLDESK_ENV=UAT`, `BILLDESK_UPSTREAM_ENABLED=false`, matching adapter auth ID/secret, and persistent `BILLDESK_ADAPTER_STATE_PATH`. Confirm separate service, environment file, port, storage and credentials; templates share generic paths.
- User reports BillDesk verbally whitelisted `64.225.85.27`. Infrastructure must verify actual adapter-process outbound egress, TLS and runtime configuration without calling BillDesk. A DNS record alone is insufficient.
- Current local UAT app origin references production `hakeemrestro.shop`; adapter origin uses `adapter.hakeemrestro.shop`. Neither proves isolation.
- Production-domain defaults, email senders/reply-to destinations and the restaurant URL remain in application code. Set app origin explicitly and review remaining hardcoded destinations before deployment.
- `vercel.json` registers review-request and daily-digest cron jobs. The new local route guards disable their work in UAT before database/email access and reject missing cron configuration. Vercel may still invoke the routes; scheduling settings remain unchanged.
- The new shared Resend guard blocks all application mail in UAT. Approve an enforced test-delivery policy before replacing that block, covering fulfillment, gifts, authentication, sampler/reservation endpoints and cron jobs. A separate mail API key alone does not restrict recipients; Supabase-managed mail is outside the Resend guard.
- Additional Info remains omitted. Merchant must confirm seven-field schema/mappings, minimum populated values and NA semantics, lengths, and ASCII hyphen versus en dash. Do not invent mappings or enable the helper.
- Merchant must accept the documented raw-audit capture exclusions. Approve retention period, legal holds, deletion operator, backup expiry and storage-growth monitoring.

## Database reconciliation

Use `docs/billdesk-uat-verify-0021.sql` only after approval, in the confirmed UAT project. It reads metadata only. Migration 0021 was reportedly applied manually; do not rerun it or run a blanket migration push.

Expected: RLS enabled; no direct table privileges for PUBLIC/anon/authenticated/service_role; trusted function owner; SECURITY DEFINER with empty search_path; three named text arguments matching the application; service_role EXECUTE, no client/public EXECUTE. Inspect all overloads and effective inherited privileges. Manual execution may not appear in migration history. Resolve any drift through a separately reviewed forward correction, not replaying 0021 or blindly marking history applied.

## Approval sequence

1. Approve a local commit of the reviewed BillDesk changes and selected handoff documents; no push.
2. Confirm intended Vercel UAT project/team and existing repository deployment triggers before approving a push of `uat`.
3. Approve configuration-only remote work and read-only UAT SQL verification separately.
4. Resolve email/cron controls and remaining deployment blockers, then request deployment approval with the exact SHA and target.
5. Keep both upstream gates disabled until merchant/infrastructure blockers are resolved and a payment test is explicitly approved.

## Proposed local commit (not staged or committed)

Suggested subject: `Harden BillDesk UAT audit binding and deployment isolation`.
The original 13-file work is preserved, with two handoff documents and five additional isolation files: 20 pending files total. Exact intended paths:

```text
app/api/billdesk/callback/route.ts
app/api/billdesk/initiate/route.ts
app/api/cron/daily-digest/route.ts
app/api/cron/review-requests/route.ts
docs/billdesk-uat-readiness-action-plan-2026-10-10.md
docs/billdesk-uat-deployment-checklist.md
docs/billdesk-uat-verify-0021.sql
lib/billdesk-handler.ts
lib/billdesk-payment.ts
lib/billdesk.ts
lib/billdesk-additional-info.ts
lib/billdesk-audit.ts
lib/resend.ts
next.config.ts
supabase/migrations/0021_billdesk_raw_audit_logs.sql
tests/unit/billdesk-initiation.test.ts
tests/unit/billdesk-routes.test.ts
tests/unit/billdesk-additional-info.test.ts
tests/unit/billdesk-raw-audit.test.ts
tests/unit/billdesk-uat-isolation.test.ts
```

Keeping the local 0021 file in version control does not authorize running it on the already-provisioned UAT database. Never run an automatic migration push as part of this deployment.

The UAT Supabase overview also reports an existing SECURITY DEFINER view advisory for `public.mv_course_stats`. Its impact/permissions were not investigated in this pass; resolve or explicitly assess it before declaring database isolation complete.
