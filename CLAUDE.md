@AGENTS.md

# Spice & Soul Academy

Indian cooking courses e-commerce platform for Hakeem's Restaurant, Indore. Sells curated recipe courses + a 5-course bundle, delivered instantly as PDFs via email. **No customer accounts** — purchase is email-only and PDFs can be re-sent anytime via `/resend`.

## Tech Stack

- **Language**: TypeScript 5 (strict)
- **Framework**: Next.js 16.2.4 — App Router, React 19, Server Components
- **Database**: Supabase (Postgres + RLS + Auth — auth used for admin only)
- **Payments**: Stripe PaymentIntents + Subscriptions + webhooks (`payment_intent.succeeded`, `charge.refunded`, `invoice.paid`, `invoice.payment_failed`)
- **Email**: Resend + React Email templates. Canonical from-address: `hello@spiceandsoul.com` (reply-to `support@spiceandsoul.com`)
- **Cron**: Vercel cron (`vercel.json`). Sends `Authorization: Bearer $CRON_SECRET`.
- **PDF**: @react-pdf/renderer — generates recipe books and invoices server-side
- **UI**: @base-ui/react + shadcn/ui scaffold + Tailwind CSS v4
- **Validation**: Zod v4 at API boundaries
- **Package manager**: pnpm

## Project Structure

```
spice-and-soul/
├── app/
│   ├── (marketing)/          # Public pages (route group, shared layout)
│   │   ├── page.tsx          # Homepage
│   │   ├── courses/          # Course listing + detail
│   │   ├── checkout/         # Two-step checkout (contact → Stripe Elements)
│   │   ├── restaurant/       # Hakeem's restaurant page
│   │   ├── thank-you/        # Post-payment confirmation
│   │   └── resend/           # Email-only "re-send my PDFs" flow (no login)
│   ├── admin/
│   │   ├── login/            # Admin password sign-in (lives outside auth gate)
│   │   └── (authed)/         # Auth-gated admin pages — courses, orders, dashboard
│   ├── api/
│   │   ├── checkout/                  # POST — creates Stripe PaymentIntent
│   │   ├── checkout-subscription/     # POST — creates Stripe Subscription (3-installment plan)
│   │   ├── resend/                    # POST — re-sends PDFs to a customer email
│   │   ├── sampler/                   # POST — free 3-recipe lead magnet
│   │   ├── coupons/validate/          # POST — coupon code validation
│   │   ├── reviews/submit/            # POST — customer review submission
│   │   ├── reservations/              # POST — restaurant reservation
│   │   ├── gift/                      # POST — gift PaymentIntent
│   │   ├── cron/review-requests/      # GET — Vercel cron: 7-day post-purchase review email
│   │   ├── stripe/webhook/            # POST — Stripe events (PI succeeded, refunds, invoices)
│   │   ├── admin/orders/[id]/refund/  # POST — admin issues refund
│   │   ├── admin/coupons/             # POST — create coupon
│   │   ├── admin/coupons/[id]/toggle/ # POST — activate/deactivate
│   │   ├── admin/reviews/[id]/publish/ # POST — moderate reviews
│   │   ├── admin/coupons/[id]/         # PATCH — edit coupon
│   │   ├── admin/reservations/[id]/    # PATCH — update reservation status
│   │   ├── cron/daily-digest/          # GET — Vercel cron: 8am ET daily ops summary
│   │   └── cron/drip/                  # GET — Vercel cron: subscriber drip emails
│   └── layout.tsx
├── components/
│   ├── ui/                   # shadcn primitives
│   ├── admin/                # Admin-only components incl. RefundButton
│   ├── email-templates/
│   ├── checkout-form.tsx
│   ├── invoice-pdf.tsx
│   └── recipe-pdf.tsx
├── lib/
│   ├── supabase/
│   │   ├── server.ts         # Anon client (SSR cookies) — Server Components, admin login
│   │   ├── admin.ts          # Service role client — API routes ONLY
│   │   └── client.ts         # Browser client
│   ├── validations/          # Zod schemas (checkout, resend, course)
│   ├── stripe.ts
│   ├── resend.ts
│   ├── send-course-email.ts  # Orchestrates PDFs + email; handles bundle expansion
│   ├── generate-recipe-pdf.ts
│   └── invoice.ts
├── types/index.ts
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_bundle_orders.sql      # parent_order_id, composite UNIQUE
│   │   ├── 0003_phase3.sql             # subscribers, reviews, coupons, reservations + orders.coupon_code/acquisition_source
│   │   ├── 0004_phase4.sql             # subscriptions, certificates, gift_orders
│   │   ├── 0005_coupon_rpc.sql         # increment_coupon_use atomic RPC
│   │   ├── 0006_reservation_status.sql # reservations.status column
│   │   ├── 0007_course_region.sql      # courses.region column (filter chips)
│   │   ├── 0008_orders_utm.sql         # orders UTM columns (utm_source/medium/campaign/content/term)
│   │   ├── 0009_course_stats_view.sql  # mv_course_stats view — bestseller badge
│   │   ├── 0012_webhook_events.sql     # webhook audit log + idempotency
│   │   └── 0015_course_preview_video.sql # courses.preview_video_url (YouTube embed)
│   └── seed/
└── tests/
    ├── unit/                 # Vitest
    └── e2e/                  # Playwright
```

## Commands

- **Install**: `pnpm install`
- **Dev**: `pnpm dev`
- **Build**: `pnpm build`
- **Test (unit)**: `pnpm test`
- **Test (e2e)**: `pnpm test:e2e`
- **Seed DB**: `pnpm seed`
- **Migrate**: `pnpm db:migrate`

## Architecture

**Two-phase checkout**: User submits name + email → `POST /api/checkout` creates a Stripe PaymentIntent and returns `clientSecret` → Stripe Elements renders for card input → `stripe.confirmPayment()` redirects to `/thank-you`.

**No customer accounts**: There is no customer login. `/resend` (public) accepts an email and, if it matches paid orders in the DB, re-emails the PDFs. Always responds with a generic success to prevent email enumeration.

**Admin auth**: `/admin/login` lives outside the `(authed)` route group. After Supabase password sign-in + `is_admin` check, the user accesses `app/admin/(authed)/*`. The authed layout redirects unauthenticated visitors back to `/admin/login?next=...`.

**Two Supabase clients**: `createClient()` (anon + RLS-scoped, SSR cookies) for Server Components and admin auth checks; `createAdminClient()` (service role, bypasses RLS) for API routes only. Never import `admin.ts` from a client component or marketing Server Component.

**Bundle orders**: When `course.is_bundle` is true, the webhook inserts one parent `orders` row (carries `amount_cents` + the bundle SKU) plus N child rows (`parent_order_id` set, `amount_cents=0`, one per included course). Resend, dashboard stats, and the orders table all filter `parent_order_id IS NULL` so revenue is not double-counted.

**Stripe webhook events**:
- `payment_intent.succeeded` — creates user (if new), inserts parent + bundle child order rows, sends recipe PDFs + invoice email, generates certificate (non-bundle), creates gift_orders row + recipient email when `metadata.isGift=true`, increments coupon `uses_count` via atomic RPC.
- `charge.refunded` — flips every `orders` row sharing the PaymentIntent to `status='refunded'`. Fired both from the admin Refund button and from manual Stripe Dashboard refunds.
- `invoice.paid` — installment plan: bootstraps `subscriptions` row on first invoice, increments `installments_paid` on subsequent.
- `invoice.payment_failed` — sets subscription `status='past_due'`.

**PDF + email delivery**: `lib/send-course-email.ts` handles single course (one recipe PDF + invoice) and bundle (N child course PDFs + one combined invoice) in the same call. Caller passes `bundleChildren` to opt into multi-PDF mode.

## Conventions

- Server Components fetch Supabase data directly — no API layer for reads
- Zod validates all external input at API route boundaries (`safeParse` → 400 on failure)
- Always filter `parent_order_id IS NULL` when reading orders for stats / revenue / display, unless you specifically want bundle children
- `@base-ui/react` Button uses `render` prop + `nativeButton={false}` for link buttons
- Custom Tailwind v4 color tokens: `saffron`, `clove`, `paprika`, `cream`, `cardamom`
- Path alias: `@/` → project root
- Types live in `types/index.ts`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # service role — server only
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=            # Stripe webhook signing secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
CRON_SECRET=                      # shared secret for Vercel cron (Bearer token)
NEXT_PUBLIC_APP_URL=              # used for Stripe return_url + resend link
UNSPLASH_ACCESS_KEY=              # image backfill script only
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=     # e.g. spiceandsoul.com — omit to disable analytics
ADMIN_DIGEST_EMAIL=               # email address for daily digest cron
```

## Important Notes

### Stripe webhook URL

Register `https://yourdomain.com/api/stripe/webhook` in Stripe Dashboard. Subscribe to:
- `payment_intent.succeeded`
- `charge.refunded`
- `invoice.paid`
- `invoice.payment_failed`

### Resend domain

Verify `spiceandsoul.com` in Resend (DKIM + SPF). All transactional mail uses `hello@spiceandsoul.com` as From, `support@spiceandsoul.com` as Reply-To.

### Vercel cron

`vercel.json` registers cron jobs. Vercel sends `Authorization: Bearer $CRON_SECRET` to the listed paths. Cron handlers must compare against `Bearer ${process.env.CRON_SECRET}` — NOT a custom `x-cron-secret` header.

### Admin client scope

`createAdminClient()` uses the service role key — it bypasses ALL RLS policies. Only import it from `app/api/` routes and admin Server Components inside `app/admin/(authed)/*`. If it leaks into a marketing Server Component or any client bundle it exposes full DB write access.

### No customer login by design

Customers do not get accounts. The webhook still creates a Supabase auth user (used as a stable `user_id` foreign key on `orders`) but the customer never authenticates as that user. Lost-email recovery is handled entirely by `/resend`.

### Next.js version

Next.js 16 has breaking changes from earlier versions. Read `node_modules/next/dist/docs/` before writing code — don't rely on pre-16 patterns.

### Image remote patterns

`next.config.ts` allows images from `*.supabase.co` only. Unsplash image URLs go through a helper (`lib/pdf-image-url.ts`) for PDF rendering since `next/image` is not available in PDF context.
