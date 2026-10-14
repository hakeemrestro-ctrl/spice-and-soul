BILLDESK UAT ADAPTER - LOCAL PHASE 1

Nothing in this directory is deployed. Do not enable upstream access, change the
existing server health service, or run database migrations against production.

Runtime: Node 24 (built-in node:sqlite), existing project tsx. No new packages.
Explicit local entrypoint after configuring synthetic adapter-only credentials:
  node --import tsx adapter/billdesk/main.ts
It does not load .env.local, listens on 127.0.0.1:3100, and supports ONLY:
  POST /uat/orders/create
  POST /uat/transactions/get
There is no health route on this new service; the existing health service remains separate.

BILLDESK_ENV must be UAT. BILLDESK_UPSTREAM_ENABLED must remain false.
The application initiation route rejects disabled mode before parsing customer
input or touching the database. Adapter disabled mode validates authentication,
limits, replay and envelope, then returns 503 with UPSTREAM_DISABLED. It does not
perform DNS, open an upstream socket, or reserve a business operation.
Tests change only their isolated in-process synthetic environment and use mock
transports to exercise both gate states. No persisted environment is enabled.
The shared application adapter client gates every operation, including retrieval.

Configuration (server-only, never NEXT_PUBLIC_):
BILLDESK_ADAPTER_URL: HTTPS origin, no path/query/credentials/custom port.
BILLDESK_ADAPTER_AUTH_KEY_ID: non-secret application key identifier.
BILLDESK_ADAPTER_AUTH_SECRET: separate random authentication secret, at least 32
UTF-8 bytes; never reuse a BillDesk password. No actual secret generated here.
BILLDESK_ADAPTER_STATE_PATH: adapter-only absolute SQLite file path in a private,
durable directory. Production deployment must review filesystem ownership/backup.
BILLDESK_DEVICE_MAC_POLICY: unset until BillDesk confirms omission, then
omit-confirmed. Unsupported/missing values fail closed; no MAC is invented.
Keep all existing BillDesk variables; unresolved profile choices remain unset.

Protocol v1 HMAC canonical input, newline separated:
version, key ID, POST, exact operation path, Unix seconds, nonce, lowercase SHA256
of the exact JSON bytes. The HMAC is lowercase hex. Timestamp tolerance +/-120s.
Only these envelope fields are allowed: operationId, traceId, timestamp, jose.
Nonce and operation ID must differ. Nonces are transactionally retained for 300s
and survive restart. Operations are retained indefinitely with started/responded/
unknown metadata, no body or token. Any repeat operation ID is rejected, including
after timeout/restart. Do not generate a replacement Create Order ID after an
ambiguous outcome: reconcile first. Create operation ID derives from stored order
ID. Retrieval operations use a fresh ID. Nonce cleanup cannot erase operation history.

Single service process only: token bucket 30/minute, burst 5; four active upstream
calls maximum. Rate state is process-local and resets on restart. Horizontal
scaling/workers require a shared limiter and shared durable replay/operation store.
Request/response max 256 KiB, enforced while reading. Upstream has raw compressed
and decoded limits. Incoming compressed envelopes are rejected. Body reception
10s; headers 5s; connect budget including DNS 5s; total upstream deadline 15s.
Vercel-to-adapter deadline 20s. Redirects rejected. Upstream DNS resolves A only;
unsafe addresses rejected and a vetted address is pinned, retaining hostname TLS
verification. There is no proxy-env support or caller destination/header forwarding.

A future approved deployment needs HTTPS reverse proxy, exact paths, loopback
service binding, preserved SSH access, inbound443 and certificate renewal. No TLS,
DNS, systemd or firewall changes were made in this phase. Verify egress from the
real service context later; verifyObservedEgress accepts an explicitly approved
observer but never contacts an IP-check service itself. No deployment-ready claim
is made: BillDesk whitelisting/profile, callbacks and UAT database remain blockers.

Device fields derive ONLY from server Headers on direct Vercel ingress, not JSON.
Use x-vercel-forwarded-for, User-Agent and Accept; validate lengths/control chars.
Local/proxied ingress cannot use invented substitutes. Review any fronting proxy
before deployment. Adapter authentication proves the application origin, not that
browser User-Agent/Accept strings are truthful.

Logging: adapter/client never prints bodies, tokens or secrets. Application logs
construct fixed metadata only. BillDesk now uses a separate durable fulfillment
executor; it does NOT call shared fulfillOrder/sendCourseEmail. Shared gateway
behavior and logs are unchanged. Provider acceptance is not delivery evidence.

REMEDIATION / UAT CONFIGURATION
- BILLDESK_UAT_APP_ORIGIN: exact isolated HTTPS origin, no production fallback.
- BILLDESK_UAT_TESTER_IDS: comma-separated verified Supabase user IDs. Empty denies
  all. Initiation verifies the auth session and exact Origin before business DB work.
- BILLDESK_UAT_HOSTED_URL and BILLDESK_UAT_HOSTED_FIELDS: exact hosted HTTPS URL
  under billdesk.com and exact comma-separated POST form names, to be confirmed
  by BillDesk. Empty/unconfirmed configuration fails before order reservation.
- Do not populate unresolved profile values with guesses or enable upstream.

Checkout attempt ID is persisted in browser localStorage before submission and in
PostgreSQL together with the pending order before dispatch. It is bound to tester,
course, amount, recipient, name and coupon. Successful retries return the saved
validated form, not a new upstream call. started/unknown outcomes require manual
reconciliation; no automatic replacement. One purchase per tester/course is a
conservative isolated-UAT restriction, including across different browser keys.
A deliberate additional purchase needs a separately reviewed operator procedure;
never delete an unresolved attempt. Cached hosted forms can expire and must not
be replaced automatically. The protected database response may contain hosted
form tokens: service-role access only, no logs/browser database grants.

BillDesk fulfillment has 15 persisted steps: immutable snapshot, user, parent
order, child orders, coupon use, recipe documents, invoice document, welcome
email, invoice email, gift order, gift documents, gift email, certificate document,
certificate record and certificate email. Non-applicable gift/bundle steps record
explicit skips. This follows actual shared behavior (including the existing
non-bundle certificate behavior for gifts) without changing other gateways.
Each PDF is saved once as base64 in a private step result and reused on recovery.
This preserves content but requires artifact storage/retention and payload-size
validation on staging before deployment; larger-scale object storage is not added.
Email completion means Resend acceptance plus stored message ID, NOT delivery.
Returned SDK errors are failures, not successful delivery. Provider idempotency
keys are additional defense; no reliance on their retention window for replay.

Recovery: no public recovery endpoint. Completed steps never replay. Pure failed
rendering may retry; failed/unknown external effects and crashed running steps
stop. A service-role operator must stop all workers for the order, inspect actual
provider/database evidence, then call billdesk_reconcile_step for that individual
step with an evidence reference, workers-stopped attestation, and either completed
(with the exact result shape) or not_applied. This is a privileged manual decision,
never an automatic timeout reset. Then recoverBilldeskFulfillment(orderId, txnId,
db) reloads the payment record and resumes unfinished steps. Never delete claims.
Legacy claims predating migration 0020 have no step version and fail closed; they
require a separate evidence-based backfill, not initialization of an empty plan.

Rollback: keep upstream disabled; revert BillDesk code only and preserve all
attempt/claim/step/reconciliation rows. Do not revert to shared best-effort
fulfillment for existing BillDesk claims. No destructive down migration is supplied.

ISOLATED POSTGRES VALIDATION PLAN (not executed here)
Use a disposable local Supabase/PostgreSQL database or verified staging project;
no production credentials or copied records. Apply prerequisite schemas and migrations 0018 through 0020
only there. Use synthetic pending orders marked paymentGateway=billdesk, mock
fulfillment/email, and separate concurrent DB sessions synchronized by a barrier.
Assert: concurrent callback+webhook => one claim; duplicates => no new fulfillment;
pending then success => one claim; success then failure => no downgrade; wrong
amount/non-BillDesk order => no mutation; same transaction on two orders => unique
constraint rejects second. Simulate crash after claim and after fulfillment but
before finish: retries must return review, not repeat effects. Recovery requires
inspection of completed side effects and explicit controlled reconciliation; no
claim deletion or automatic re-claim. Preserve ledgers on rollback. No isolated
PostgreSQL instance has been established; SQLite tests prove only adapter replay
storage, not Supabase payment-lock correctness.

Offline checks:
  node --import ./tests/billdesk-server-condition.mjs --import tsx tests/test-billdesk-jose.ts
  node node_modules/vitest/vitest.mjs run --config vitest.billdesk.config.mts
  node node_modules/typescript/bin/tsc --noEmit --incremental false
Use Node24 for SQLite tests. All test credentials/payloads are synthetic; .env.local
is not loaded. Current code paths for Paytm/PayGlocal remain unchanged.

ADDITIONAL POSTGRES VALIDATION (outstanding)
Use real independent connections for reserve races (same key and different keys
for same tester/course), immutable binding mismatches, crash-before/after-dispatch,
step claim races, worker death after external effect and before result persistence,
wrong owner finishing, incomplete manifest completion, legacy claim protection,
manual evidence reconciliation and late worker completion. Verify permissions
with anon/authenticated/service_role separately. Unit store models are not proof
of SQL correctness or PostgreSQL concurrency. No isolated database is available.

REMAINING DEPLOYMENT WARNINGS
Adapter ingress still needs a reverse-proxy pre-auth request/connection rate cap
and body/header limits. Existing authenticated limiter is process-local and
requires a single process; it resets on restart. SQLite operation identities still
include auth key ID; rotation must preserve dedupe and receive a dedicated review.
Application durable checkout reservation adds independent business dedupe but does
not eliminate adapter administration requirements. Runtime TLS/DNS/egress and real
socket cancellation need isolated integration validation before deployment.
Production client bundle was not built; server-only guards and static import graph
checks are tested. No infrastructure changes are part of this remediation.
