"use client";

import { useState } from "react";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "@/components/checkout-form";
import { Lock, Gift } from "lucide-react";
import type { Course } from "@/types";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const stripeAppearance: StripeElementsOptions["appearance"] = {
  theme: "stripe",
  variables: {
    colorPrimary: "#f29b1f",
    colorBackground: "#ffffff",
    colorText: "#3e2c19",
    colorDanger: "#a13818",
    fontFamily: "Geist, system-ui, sans-serif",
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #ddc9af", padding: "11px 13px", boxShadow: "none" },
    ".Input:focus": { border: "2px solid #f29b1f", boxShadow: "0 0 0 4px rgba(242,155,31,0.20)" },
    ".Label": { color: "#281a0d", fontWeight: "500" },
  },
};

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

export function GiftCheckoutClient({ course }: { course: Course }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          senderEmail,
          senderName,
          recipientEmail,
          recipientName: recipientName || undefined,
          message: message || undefined,
        }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        setError(data.error ?? "Something went wrong");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (clientSecret) {
    return (
      <div>
        <p className="mb-4 font-sans text-sm text-clove-600">
          Gifting <strong>{course.title}</strong> to{" "}
          <strong>{recipientEmail}</strong> · {formatDollars(course.price_cents)}
        </p>
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
          <CheckoutForm priceCents={course.price_cents} />
        </Elements>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="mb-1 flex items-center gap-2 font-sans text-sm font-semibold text-clove-700">
        <Gift className="size-4 text-saffron-500" aria-hidden />
        Your details (sender)
      </div>
      <Field label="Your name" value={senderName} onChange={setSenderName} required />
      <Field label="Your email" type="email" value={senderEmail} onChange={setSenderEmail} required />

      <hr className="border-cream-200" />

      <div className="mb-1 font-sans text-sm font-semibold text-clove-700">Recipient details</div>
      <Field label="Recipient name (optional)" value={recipientName} onChange={setRecipientName} />
      <Field label="Recipient email" type="email" value={recipientEmail} onChange={setRecipientEmail} required />

      <div>
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">
          Personal message <span className="font-normal text-clove-400">(optional)</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Happy birthday! Hope you enjoy cooking these recipes…"
          className="w-full resize-none rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none placeholder:text-clove-300 focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
        />
      </div>

      <div className="rounded-xl border border-cream-200 bg-cream-100 p-4 font-sans text-sm text-clove-600">
        <span className="font-semibold text-clove-700">{course.title}</span>
        {" · "}
        <span className="font-semibold">{formatDollars(course.price_cents)}</span>
        {" · "}
        {course.recipe_count} recipes — instant email delivery to recipient
      </div>

      {error && <p className="font-sans text-sm text-paprika-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-saffron-400 font-sans text-[15px] font-semibold text-clove-700 hover:bg-saffron-500 disabled:opacity-60"
      >
        <Gift className="size-4" aria-hidden />
        {loading ? "Loading…" : `Gift for ${formatDollars(course.price_cents)}`}
      </button>

      <p className="flex items-center justify-center gap-1.5 font-sans text-xs text-clove-400">
        <Lock className="size-3" aria-hidden />
        Secure checkout · Stripe
      </p>
    </form>
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
      <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none transition-shadow placeholder:text-clove-300 focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
      />
    </div>
  );
}
