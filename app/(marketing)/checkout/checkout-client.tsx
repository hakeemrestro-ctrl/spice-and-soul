"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Lock, Check, ShieldCheck, Star, Tag } from "lucide-react";
import PaytmCheckoutEmbed from "@/components/paytm-checkout-embed";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/plausible";
import type { Course } from "@/types";

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

const FEATURES = [
  "Instant email delivery",
  "PDF recipe book — yours forever",
  "Re-send anytime, no login needed",
  "PDF invoice included",
];

const PULL_QUOTE = {
  quote: "My butter chicken finally tasted like a restaurant. The kasuri methi tip alone was worth the price.",
  name: "Sarah M.",
  city: "Brooklyn, NY",
};

type CouponResult = {
  code: string;
  discountCents: number;
  finalCents: number;
};

type PaytmConfig = {
  orderId: string;
  mid: string;
  amount: string;
  txnToken: string;
  host: string;
};

type Gateway = "paytm" | "billdesk";

export default function CheckoutPageClient({ course }: { course: Course }) {
  const [paytmConfig, setPaytmConfig] = useState<PaytmConfig | null>(null);
  const [contactInfo, setContactInfo] = useState<{ email: string; name: string } | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);

  const handleContactSubmit = async (
    email: string,
    name: string,
    gateway: Gateway,
    couponCode?: string,
  ) => {
    const params = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

    const utmFields = {
      utmSource: params.get("utm_source") ?? undefined,
      utmMedium: params.get("utm_medium") ?? undefined,
      utmCampaign: params.get("utm_campaign") ?? undefined,
      utmContent: params.get("utm_content") ?? undefined,
      utmTerm: params.get("utm_term") ?? undefined,
    };

    const payload = {
      courseId: course.id,
      email,
      name,
      ...(couponCode ? { couponCode } : {}),
      ...(utmFields.utmSource ? { acquisitionSource: utmFields.utmSource } : {}),
      ...Object.fromEntries(
        Object.entries(utmFields).filter(([, v]) => v !== undefined),
      ),
    };

    // BillDesk — hosted redirect flow via form post.
    if (gateway === "billdesk") {
      const attemptId = crypto.randomUUID();
      const res = await fetch("/api/billdesk/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attemptId },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.hostedUrl && data.hostedParameters) {
        trackEvent("checkout_started", { course: course.title, gateway: "billdesk" });

        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.hostedUrl;

        for (const [key, value] of Object.entries(data.hostedParameters)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
        return;
      }
      throw new Error(data.error ?? "Checkout failed");
    }

    // Paytm — All-in-One JS modal flow.
    const res = await fetch("/api/paytm/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.orderId && data.txnToken && data.host && data.mid && data.amount) {
      setContactInfo({ email, name });
      setPaytmConfig({
        orderId: data.orderId,
        mid: data.mid,
        amount: data.amount,
        txnToken: data.txnToken,
        host: data.host,
      });
      trackEvent("checkout_started", { course: course.title, gateway: "paytm" });
    } else {
      const paytmErr = data.paytm?.resultMsg ? ` (${data.paytm.resultMsg})` : "";
      throw new Error((data.error ?? "Checkout failed") + paytmErr);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="mb-8">
        <Link
          href="/courses"
          className="font-sans text-sm text-clove-500 no-underline hover:text-clove-700"
        >
          ← Back to courses
        </Link>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
        {/* Left: form */}
        <div>
          <h1 className="m-0 mb-1.5 font-display text-4xl text-clove-700">
            {course.title}
          </h1>
          <p className="mb-8 font-sans text-[15px] text-clove-500">
            {paytmConfig && contactInfo?.email ? `${contactInfo.email} · ` : ""}
            {appliedCoupon ? (
              <>
                <span className="line-through text-clove-300">{formatRupees(course.price_cents)}</span>
                {" "}
                <span className="font-semibold text-cardamom-600">{formatRupees(appliedCoupon.finalCents)}</span>
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-cardamom-100 px-2 py-0.5 text-xs font-medium text-cardamom-700">
                  <Tag className="size-3" aria-hidden />
                  {appliedCoupon.code}
                </span>
              </>
            ) : formatRupees(course.price_cents)}
            {" "}· {course.recipe_count} recipes
          </p>

          {!paytmConfig ? (
            <ContactForm
              courseId={course.id}
              onSubmit={handleContactSubmit}
              onCouponApplied={setAppliedCoupon}
              billdeskEnabled={
                process.env.NEXT_PUBLIC_BILLDESK_ENABLED === "true"
              }
            />
          ) : (
            <PaytmCheckoutEmbed
              orderId={paytmConfig.orderId}
              mid={paytmConfig.mid}
              amount={paytmConfig.amount}
              txnToken={paytmConfig.txnToken}
              host={paytmConfig.host}
              onCancel={() => setPaytmConfig(null)}
            />
          )}
        </div>

        {/* Right: sticky trust panel */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 overflow-hidden rounded-3xl border border-cream-200 bg-cream-50 shadow-warm-md">
            {/* Course image or gradient */}
            <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-saffron-100 to-saffron-300">
              {course.image_url ? (
                <Image
                  src={course.image_url}
                  alt={course.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="select-none font-display text-[80px] italic leading-none text-clove-700/20">
                  {course.title.charAt(0)}
                </span>
              )}
            </div>

            <div className="p-6">
              <p className="mb-0.5 font-display text-lg leading-snug text-clove-700">
                {course.title}
              </p>
              <p className="mb-4 font-sans text-xs text-clove-400">
                {course.recipe_count} recipes
              </p>

              {/* Price */}
              <div className="mb-5 font-display text-4xl leading-none text-clove-700">
                {appliedCoupon ? (
                  <>
                    <span className="text-2xl line-through text-clove-300">{formatRupees(course.price_cents)}</span>
                    {" "}
                    <span className="text-cardamom-700">{formatRupees(appliedCoupon.finalCents)}</span>
                  </>
                ) : formatRupees(course.price_cents)}
              </div>

              {/* Features */}
              <ul className="mb-5 space-y-2">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 font-sans text-xs text-clove-600">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-cardamom-600" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Pull quote */}
              <blockquote className="mb-5 rounded-2xl border border-cream-200 bg-cream-100 p-4">
                <div className="mb-1.5 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="size-3 fill-saffron-400 text-saffron-400" aria-hidden />
                  ))}
                </div>
                <p className="mb-2 font-sans text-xs leading-relaxed text-clove-600">
                  &ldquo;{PULL_QUOTE.quote}&rdquo;
                </p>
                <footer className="font-sans text-[11px] text-clove-400">
                  {PULL_QUOTE.name} · {PULL_QUOTE.city}
                </footer>
              </blockquote>

              {/* Badges */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-sans text-xs text-clove-500">
                  <Lock className="size-3.5 shrink-0 text-clove-400" aria-hidden />
                  Secured by Paytm — UPI, cards & wallets
                </div>
                <div className="flex items-center gap-1.5 font-sans text-xs text-clove-500">
                  <ShieldCheck className="size-3.5 shrink-0 text-cardamom-500" aria-hidden />
                  30-day money-back guarantee
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ContactForm({
  courseId,
  onSubmit,
  onCouponApplied,
  billdeskEnabled,
}: {
  courseId: string;
  onSubmit: (
    email: string,
    name: string,
    gateway: Gateway,
    couponCode?: string,
  ) => Promise<void>;
  onCouponApplied: (coupon: CouponResult | null) => void;
  billdeskEnabled: boolean;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [gateway, setGateway] = useState<Gateway>("paytm");
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const couponTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCouponChange = (val: string) => {
    setCouponCode(val);
    setAppliedCoupon(null);
    onCouponApplied(null);
    setCouponStatus("idle");
    setCouponMsg(null);

    if (!val.trim()) return;

    if (couponTimer.current) clearTimeout(couponTimer.current);
    couponTimer.current = setTimeout(async () => {
      setCouponStatus("checking");
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: val.trim(), courseId }),
        });
        const data = await res.json();
        if (res.ok && data.valid) {
          const result: CouponResult = {
            code: data.code,
            discountCents: data.discountCents,
            finalCents: data.finalCents,
          };
          setAppliedCoupon(result);
          onCouponApplied(result);
          setCouponStatus("valid");
          setCouponMsg(`Saving ${formatRupees(data.discountCents)}!`);
          trackEvent("coupon_applied", { code: data.code, discount_cents: data.discountCents });
        } else {
          setCouponStatus("invalid");
          setCouponMsg(data.error ?? "Invalid coupon");
        }
      } catch {
        setCouponStatus("invalid");
        setCouponMsg("Could not validate coupon");
      }
    }, 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(email, name, gateway, appliedCoupon?.code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Full name" value={name} onChange={setName} required />
      <Field
        label="Email address"
        type="email"
        value={email}
        onChange={setEmail}
        required
      />

      {/* Coupon code */}
      <div>
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">
          Promo code <span className="text-clove-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <Tag className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-clove-400" aria-hidden />
          <input
            type="text"
            value={couponCode}
            onChange={(e) => handleCouponChange(e.target.value)}
            placeholder="Enter code"
            className="w-full rounded-[10px] border border-clove-200 bg-cream-0 py-2.5 pl-10 pr-3.5 font-sans text-[15px] uppercase text-clove-700 outline-none transition-shadow placeholder:normal-case placeholder:text-clove-300 focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
          />
        </div>
        {couponStatus === "checking" && (
          <p className="mt-1 font-sans text-xs text-clove-400">Checking…</p>
        )}
        {couponStatus === "valid" && couponMsg && (
          <p className="mt-1 flex items-center gap-1 font-sans text-xs font-medium text-cardamom-600">
            <Check className="size-3.5" aria-hidden />
            {couponMsg}
          </p>
        )}
        {couponStatus === "invalid" && couponMsg && (
          <p className="mt-1 font-sans text-xs text-paprika-600">{couponMsg}</p>
        )}
      </div>

      {/* Payment method selector */}
      {billdeskEnabled && (
        <div>
          <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">
            Payment method
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GatewayOption
              selected={gateway === "paytm"}
              onSelect={() => setGateway("paytm")}
              title="Paytm"
              subtitle="UPI · Cards · Wallets"
            />
            <GatewayOption
              selected={gateway === "billdesk"}
              onSelect={() => setGateway("billdesk")}
              title="BillDesk"
              subtitle="UPI · Cards · Net Banking"
            />
          </div>
        </div>
      )}

      {error && <p className="font-sans text-sm text-paprika-600">{error}</p>}
      <Button
        type="submit"
        variant="clove"
        disabled={loading}
        className="mt-2 h-12 w-full rounded-xl text-[15px]"
      >
        {loading ? "Loading…" : "Continue to payment"}
      </Button>
      <p className="mt-2 flex items-center justify-center gap-1.5 font-sans text-xs text-clove-400">
        <Lock className="size-3" aria-hidden />
        Payments secured by {gateway === "billdesk" ? "BillDesk" : "Paytm"}
      </p>
    </form>
  );
}

function GatewayOption({
  selected,
  onSelect,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors ${selected
        ? "border-saffron-400 bg-saffron-50 ring-2 ring-saffron-400/30"
        : "border-clove-200 bg-cream-0 hover:border-clove-300"
        }`}
    >
      <span className="flex w-full items-center justify-between font-sans text-[15px] font-semibold text-clove-700">
        {title}
        {selected && <Check className="size-4 text-saffron-500" aria-hidden />}
      </span>
      <span className="font-sans text-xs text-clove-400">{subtitle}</span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none transition-shadow focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
      />
    </div>
  );
}
