# BillDesk UAT readiness — step-by-step action plan

Date: 10 October 2026 (Asia/Calcutta)  
Status: **BLOCKED — no isolated UAT deployment target or BillDesk whitelist confirmation verified**  
Scope: UAT preparation only. Do not deploy, migrate a cloud database, enable upstream, contact BillDesk APIs, or initiate a payment based on this plan.

This plan continues [the production-readiness audit](./billdesk-production-readiness-audit-2026-10-10.md). Its 232 passing BillDesk tests, 18 passing JOSE tests, prior disposable PostgreSQL checks, and local code fixes are not repeated here. They are local evidence, not a UAT transaction. No code, environment, cloud resource, or payment configuration was changed while preparing this plan.

## Verified starting point

- Vercel account inspected: one visible project, `spice-and-soul`, ID `prj_zGFKElkYpTpXDlroHd8LhAfNTfTn`, with Production domains. The name `spice-and-soul-sand.vercel.app` is also assigned to Production; it is **not** evidence of an isolated UAT project.
- Supabase organization inspected: one visible project, ref `whkamivxzpgmgvnaooae`, labeled `main / Production`. No separate UAT project or branch was visible. The local `.env.local` Supabase URL has a `dummy` host label and is not a verified UAT database. Other company accounts may exist, but have not been identified.
- DigitalOcean Droplet `billdesk-adapter` previously had observed outbound IPv4 `64.225.85.27`, default route `10.47.0.1` via `eth0`, and a strictly verified SSH host key. Only a loopback health service existed; the functional BillDesk adapter and its HTTPS endpoint were **not** deployed or verified. Reserved-IP assignment and a generic `curl` do not prove the eventual adapter service's egress or BillDesk whitelist status.
- Local `.env.local` has non-empty UAT ID/key variable names for merchant/client/key ID and JWE/JWS passwords; actual values were not read or displayed. The remaining profile, UAT app, adapter, and enable settings are not configured. The uncommitted local implementation must not be assumed present on the live site.

## Step 1 — Establish separately approved UAT targets

**Owner: you/company project owner for approval; infrastructure team for provisioning and evidence.**

- [ ] Determine whether separate company-owned UAT Vercel and Supabase projects already exist in another account. Record the **Vercel project ID and team**, **Supabase project ref and organization**, owner, region, and who approved their use for BillDesk UAT. If absent, have the infrastructure team provision separate projects only after your normal resource/cost approval.
- [ ] Obtain an approved, exact HTTPS UAT application origin and an approved, exact HTTPS adapter origin. Use placeholders until approved; do **not** reuse `https://hakeemrestro.shop` or any Production-assigned Vercel domain as UAT by name alone.
- [ ] Verify UAT Vercel's deployment/branch/domain mapping and access protection, and link it only to the approved UAT Supabase project. Confirm the UAT database ref differs from all production refs. Populate it with synthetic courses, users, coupons and orders only; do not clone customer/payment records. `BILLDESK_ENV=UAT` alone does not isolate data.
- [ ] Document a legitimate UAT tester sign-in path and allowlisted Supabase user IDs without granting unnecessary admin privileges. Confirm the tester session is from the UAT Supabase project.
- [ ] Retain an approval record showing the project IDs, domains, DNS ownership, database classification, and owners. **Acceptance:** exact IDs and HTTPS origins can be independently matched to the authorized dashboards and no UAT secret points to production data.

## Step 2 — Obtain BillDesk's merchant-specific written profile

**Owner: you can assemble/send non-secret questions; BillDesk relationship manager/support must answer and activate merchant settings.**

Public BillDesk documentation establishes the general flow: JSON → JWE encryption → JWS signing; verify JWS then decrypt JWE on response; `application/jose` request/accept headers; unique `BD-Traceid`; and UAT Create Order/Retrieve endpoints. Its example uses `dir` and `A256GCM` for JWE and describes separate encryption/signing keys. The integration FAQ illustrates `HS256` in a JWS header. These are useful implementation checks but **do not prove this merchant's exact profile**. [Authentication and Endpoints](https://docs.billdesk.io/reference/authentications-and-endpoints), [Get Started](https://docs.billdesk.io/docs/get-started-payments), [Integration FAQ](https://docs.billdesk.io/docs/integration-faqs).

Obtain a written answer associated with the UAT Merchant ID and Client ID (record identifiers in the secure company system, not this report) for each item:

- [ ] Symmetric-key versus merchant-public-key JOSE profile; JWE `alg`/`enc`, JWS `alg`, key encoding/byte length, and any rotation/version rules. The current code supports raw UTF-8 bytes, `dir`/`A256GCM`, and `HS256` only. A different approved profile requires a reviewed code change, never a coerced secret.
- [ ] Whether the supplied single `BILLDESK_KEY_ID` is valid for **both** request JWE and JWS; exact expected `kid` and `clientid` in **both response headers**; whether response key IDs differ from request IDs. The current verifier requires the same `kid`/`clientid` in both layers.
- [ ] Exact `BD-Timestamp` **format, timezone, units and allowed clock skew** for these endpoints. The authentication page says “epoch timestamp,” but the Create Order and Retrieve Transaction references illustrate a 14-digit `YYYYMMDDhhmmss` value. Do not select `ist-calendar`, `epoch-seconds`, or `epoch-milliseconds` until BillDesk resolves this conflict in writing. [Create Order](https://docs.billdesk.io/reference/createorder), [Retrieve Transaction](https://docs.billdesk.io/reference/post-payments-v1_2-transactions-get).
- [ ] Merchant item code, enabled payment methods and international-card capability; exact required device fields, including whether browser MAC can be omitted. The application refuses to fabricate a MAC and will remain blocked until omission or another legitimate collection method is approved.
- [ ] Neo Full Redirect UAT POST URL and exact form-field names/values; confirm `rel: "redirect"`, expected `mercid` versus `merchantid`, `bdorderid`, `rdata`, link lifetime and whether any additional field is required. The BillDesk response example uses `mercid` while its sample HTML names `merchantid`; use the merchant-specific contract. [Neo Full Redirect](https://docs.billdesk.io/docs/neo-full-redirect).
- [ ] Exact callback and webhook content type/envelope, status values, retry/acknowledgement policy and whether the UAT return URL and secured S2S webhook URL below are registered for this Merchant ID. BillDesk states only one webhook URL can be configured per merchant ID; do not redirect a production merchant's webhook to UAT. [Get Started](https://docs.billdesk.io/docs/get-started-payments), [Webhooks](https://docs.billdesk.io/docs/webhooks-lcm-notifications).
- [ ] UAT endpoint/merchant availability for **both** Create Order and Retrieve Transaction and any environment-specific restrictions.

**Acceptance:** a dated written merchant-profile record covers every item and is reviewed against the deployed UAT variable names and code. Do not place credential values in tickets, chat, logs or source control.

## Step 3 — Confirm static egress and UAT IP whitelist

**Owner: infrastructure team verifies deployed path; you/BillDesk support confirm merchant whitelist.**

- [ ] Infrastructure team records that Reserved IPv4 `64.225.85.27` is still assigned to the intended DigitalOcean Droplet and that the running **adapter process** sends IPv4 HTTPS traffic from that address. Use an approved observer; a shell `curl` alone is insufficient service evidence. Preserve strict SSH host-key verification, the existing route, health service and SSH access.
- [ ] BillDesk confirms in writing or via a recorded UAT-portal configuration that **`64.225.85.27` is active on this exact UAT Merchant ID** as a public static API source IP. Record the environment, merchant association, effective status/date and owner. BillDesk documentation says API calls from unwhitelisted IPs are rejected and that static public IPs, not domains, are whitelisted. [Integration FAQ](https://docs.billdesk.io/docs/integration-faqs), [Get Started](https://docs.billdesk.io/docs/get-started-payments).
- [ ] Confirm no direct Vercel-to-BillDesk API path or fallback remains in the **deployed revision**. Vercel's changing outbound address must never be the BillDesk API source.
- [ ] After separate authorization for a UAT request, use BillDesk-side logs/response to corroborate the observed source IP. No such request is authorized by this plan.

## Step 4 — Prepare the HTTPS adapter without enabling upstream

**Owner: infrastructure team; requires separate deployment authorization. This is a checklist, not a deployment instruction to execute now.**

- [ ] Review and deploy the local `adapter/billdesk` code to the existing Droplet using Node 24, as a dedicated unprivileged system service on loopback. Keep the existing `127.0.0.1:3000` health service intact; adapter code expects `127.0.0.1:3100` and no public generic proxy.
- [ ] Install/configure an approved HTTPS reverse proxy and certificate for the exact adapter origin, exposing only `POST /uat/orders/create` and `POST /uat/transactions/get` to the application. Preserve SSH/Web Console access. Allow inbound 443 only as needed; reject other routes/methods. Do not expose loopback 3100 or SQLite state publicly.
- [ ] Provision an adapter-only HMAC key ID and strong secret in the server's protected secret store and the **UAT Vercel project's server-only** store; do not reuse BillDesk JWE/JWS passwords. Set a private durable absolute `BILLDESK_ADAPTER_STATE_PATH` with correct ownership and backup/restart policy. Use one process/instance unless nonce, operation and rate-limit state are made shared.
- [ ] Verify certificate chain, exact-path routing, HMAC failure, replay rejection across restart, bounded request/response, timeouts, disabled-upstream 503, secret-safe logs, and actual service-context IPv4 egress. `BILLDESK_UPSTREAM_ENABLED` stays false on both app and adapter during these non-payment checks.
- [ ] Record the deployed commit/revision, service unit, reverse-proxy config, health/alert checks, evidence locations and rollback command. **Acceptance:** HTTPS and authentication work while every BillDesk operation still fails closed before external DNS/socket creation.

## Step 5 — Prepare isolated UAT application/database configuration

**Owner: infrastructure team configures; you approve exact targets. No cloud migration or deployment in this task.**

| Target | Names to configure after approval | Guardrail |
| --- | --- | --- |
| UAT Vercel, server-only | `BILLDESK_ENV=UAT`, `BILLDESK_MERCID`, `BILLDESK_CLIENT_ID`, `BILLDESK_KEY_ID`, `BILLDESK_JWE_PASSWORD`, `BILLDESK_JWS_PASSWORD`, `BILLDESK_KEY_ENCODING`, `BILLDESK_JWS_ALGORITHM`, `BILLDESK_TIMESTAMP_FORMAT`, `BILLDESK_DEVICE_MAC_POLICY` | Use only merchant-approved **UAT** values. Never copy production keys; do not show values in logs or reports. |
| UAT Vercel, server-only | `BILLDESK_UAT_APP_ORIGIN`, `BILLDESK_UAT_TESTER_IDS`, `BILLDESK_UAT_HOSTED_URL`, `BILLDESK_UAT_HOSTED_FIELDS`, `BILLDESK_ADAPTER_URL`, `BILLDESK_ADAPTER_AUTH_KEY_ID`, `BILLDESK_ADAPTER_AUTH_SECRET` | Exact approved HTTPS origins/profile; tester IDs belong to isolated UAT auth; adapter secret distinct from BillDesk secrets. |
| UAT Vercel, Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | All three must belong to the **same isolated UAT project**; service role is server-only. Verify public project ref and key-project association without printing secrets. |
| UAT Vercel, gates | `BILLDESK_UPSTREAM_ENABLED=false`, `NEXT_PUBLIC_BILLDESK_ENABLED=false` | Keep disabled until every dependency passes and a separate UAT-payment approval is given. Production project flags and credentials stay unchanged. |
| UAT adapter process | `BILLDESK_ENV=UAT`, `BILLDESK_ADAPTER_AUTH_KEY_ID`, `BILLDESK_ADAPTER_AUTH_SECRET`, `BILLDESK_ADAPTER_STATE_PATH`, `BILLDESK_UPSTREAM_ENABLED=false` | No application DB or BillDesk secret values are needed by the current adapter; never load the application's `.env.local` into it. |

The future UAT callback must be **`https://<approved-uat-app-origin>/api/billdesk/callback`** and the UAT S2S webhook **`https://<approved-uat-app-origin>/api/billdesk/webhook`**. These are URL patterns, not approved or registered URLs. Both must terminate on the isolated UAT app; neither is the adapter URL. BillDesk must confirm registration for this UAT Merchant ID before any transaction.

- [ ] Inspect UAT schema prerequisites and migration order, then apply 0018, 0019, 0020 and the new 0021 raw-audit migration **only** to the isolated UAT Supabase project after separate authorization. Review 0021's sensitive-token retention/access policy and test that audit RPC failure stops dispatch. Record migration IDs, permissions and rollback/forward-repair approach; do not run `supabase db push` against an unverified link.
- [ ] Rerun separate-connection callback/webhook concurrency, duplicates, pending→success, success→failure, wrong amount, non-BillDesk order, transaction reuse, rollback, crash and step-recovery cases on **synthetic UAT data**. The prior disposable PostgreSQL pass does not establish cloud deployment correctness.
- [ ] Validate deployed revision equivalence, tester auth, callback/webhook routing, server-only boundaries and disabled upstream before requesting a UAT-payment test window.

## Step 6 — UAT test and evidence gate (later, separately authorized)

Only after Steps 1–5 are evidenced and the user explicitly authorizes UAT payment requests: enable UAT-only upstream, conduct a small controlled transaction, and verify the hosted page, callback/webhook, Retrieve response, merchant/order/transaction/amount/currency binding, one claim, order status, fulfillment steps and email acceptance versus actual delivery. Include failure, cancellation, pending, duplicate, timeout and uncertain-outcome recovery. Capture redacted IDs/timestamps and database rows in an access-controlled evidence record. Do not enable production or use a live card under this plan.

## Exact next action

**You:** ask your company/infrastructure owner for the **approved isolated UAT Vercel project ID, Supabase project ref, and exact HTTPS UAT app/adapter origins**, or for approval to provision separate resources if they do not yet exist. Have them identify the owning account/team and explicitly attest that neither target is production. Share only those non-secret identifiers and the location of the approval record. In parallel, send the Step 2 non-secret question list to BillDesk support and request written UAT whitelist confirmation for `64.225.85.27`. Until those records exist, UAT readiness remains **blocked** and both enable flags remain false.

## 15 October local update

The current checkout contains additional uncommitted BillDesk audit changes and migration 0021. Local BillDesk-only fixes removed customer email/name from optional Create Order `additional_info`, prevented callback success from relying on an unpersisted token transaction ID, and made raw-audit RPC failures fail closed. The complete local BillDesk suite passed 248/248 after its initiation fixture was updated for the new audit RPC; TypeScript passed. These are simulated/local results, not UAT payment evidence. Local `.env.local` has non-empty UAT configuration names, but their merchant approval and project association remain unverified; `BILLDESK_UPSTREAM_ENABLED` is disabled and the public selector variable is unset. The currently connected Supabase organization exposes only unrelated Re-Fraze projects (`htjrnlitrclesflyyvvl`, `vxwkdsebyzapbgproags`), so neither is an approved UAT target for this website. No cloud deployment, migration, BillDesk request or payment occurred in this update.

## 16 October review: audit contract and remaining approvals

The 248-test result above predates this review's regression additions. Fresh Node 24.19.0 validation after the scoped fixes: TypeScript passed; 277/277 tests across 12 files passed; targeted ESLint on all 11 pending BillDesk TypeScript files passed; `git diff --check` passed (line-ending warnings only). These checks used existing dependencies with the required filesystem access. The regression tests use synthetic transport/database fixtures; migration permissions were reviewed statically, not executed. No merchant payload approval, deployment, database migration or payment is implied by local tests.

### Capture scope and failure handling

Raw audit means preserving the selected encoded string unchanged, not retaining every wire response and not proving that every stored string is valid JOSE.

| Message | Persistence boundary | Failure handling |
| --- | --- | --- |
| Create Order / Retrieve request | After JOSE creation, before adapter dispatch | Audit failure prevents that dispatch. Checkout remains unknown/requires reconciliation; an existing attempt is not automatically redispatched. |
| Successful adapter response | Only bounded, non-redirect, successful `application/jose` bodies returned by the adapter client; stored before JOSE verification | Audit or verification failure prevents checkout success/payment claim. A completed upstream request cannot be undone. |
| Callback / webhook | After JWS/JWE verification and payment-envelope validation; original token unchanged | Invalid body/signature/envelope is excluded. A later database binding rejection can still leave authenticated audit evidence. |
| Callback audit failure | No terminal order status is displayed | Browser receives only a generic pending redirect; no claim, fulfillment or Retrieve request. |
| Webhook audit failure | Includes inbound token and both Retrieve audit points | HTTP 503; no payment claim/fulfillment or success acknowledgement. |

Rejected inbound raw tokens and non-success, wrong-content-type, oversized or transport-failed adapter responses are not retained in this table. Routes emit only redacted operational categories/correlation IDs, never token/error bodies. A successful HTTP JOSE body that fails cryptographic verification is retained as untrusted reconciliation evidence. Merchant support must confirm that these exclusions meet their audit checklist; broader capture needs a separately reviewed, bounded quarantine design rather than storage under unverified order IDs.

Callback status display now requires a valid merchant/client/currency/status/amount envelope and a matching stored BillDesk order/amount. Paid display additionally requires the persisted transaction ID to match the token. Failed display requires a failure notification and failed database state. It never calls Retrieve or fulfills; webhook Retrieve remains authoritative for payment state.

### Additional Info: supplied support checklist, not an approved schema

User-supplied BillDesk Integration Support email wording:

- Point 6: “Confirm that you are passing at least 3 values under Additional info 1 to 7 as it is mandatory. In case value is unavailable/missing for any of the additional info fields, please pass NA, but do not leave it blank.”
- Point 7: “Note that you are supposed to include minimum and maximum 7 as Additional info in the payload.”
- Point 12: “Confirm that no disallowed special characters are passed anywhere in the Additional Info1 to 7. Allowed characters are @ , . –”

The draft helper now accepts seven neutral slots; it does not assign email/name/course or other customer data to fields. It fills missing slots with NA and separately checks exactly seven keys and at least three non-NA values. The existing key names, ASCII hyphen policy and local 100-character cap are provisional. Confirm the object/array schema, exact key names and mappings, length limit, whether NA counts toward the three values, and ASCII `-` versus the email's Unicode `–`. Create Order continues to omit Additional Info, with a regression assertion. Because the email calls it mandatory, merchant confirmation and a later reviewed implementation are a UAT payment blocker.

### Migration 0021 access and retention

The prepared SQL revokes all direct audit-table privileges from PUBLIC, anon, authenticated and service_role, including any default direct grants. The application receives only EXECUTE on `billdesk_record_raw_audit(p_order_id text, p_operation text, p_raw_token text)`. The SECURITY DEFINER RPC uses an empty search_path and a schema-qualified insert. It must be owned by the trusted migration owner, normally postgres, not service_role. No customer-facing audit read/delete API is provided.

Before any authorized application, inspect the target's migration history; if 0021 already exists, do not rerun or silently rewrite its deployed history. Reconcile its actual definition/ACLs and plan a separate forward migration if needed. On the approved isolated database, verify schema USAGE/API exposure, the function owner and EXECUTE grant, denied direct table access for service_role, denied anon/authenticated execution, successful RPC insertion and unchanged raw-token storage. These effective-permission checks have not been executed in this review.

No deletion job or retention interval is invented here. Infrastructure/security owners must approve retention duration, legal holds, backup expiry, privileged read access, an independently authorized deletion procedure and storage-growth monitoring (including repeated valid notifications). Only a privileged operator should perform approved retention deletion. Database owners/superusers retain access; this is not immutable or tamper-proof evidence. Keep UAT upstream disabled until this policy and the migration verification are complete.
