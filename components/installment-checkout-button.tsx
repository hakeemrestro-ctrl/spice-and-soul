"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "@/components/checkout-form";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Props = {
  courseId: string;
  monthlyCents: number;
};

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toFixed(2)}`;
}

export function InstallmentCheckoutButton({ courseId, monthlyCents }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, email, name }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        setError(data.error ?? "Failed to start installment plan");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="w-full rounded-xl border border-clove-200 bg-cream-0 px-4 py-3 font-sans text-sm font-medium text-clove-600 hover:border-clove-300 hover:bg-cream-100"
      >
        Or pay {formatDollars(monthlyCents)}/mo × 3 installments
      </button>
    );
  }

  if (clientSecret) {
    return (
      <div className="rounded-2xl border border-cream-200 bg-cream-0 p-4">
        <p className="mb-3 font-sans text-xs text-clove-500">
          First installment · {formatDollars(monthlyCents)} today
        </p>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm priceCents={monthlyCents} />
        </Elements>
      </div>
    );
  }

  return (
    <form onSubmit={handleContactSubmit} className="flex flex-col gap-3">
      <p className="font-sans text-xs text-clove-500 font-medium">
        Pay {formatDollars(monthlyCents)}/mo × 3 months · 0% interest
      </p>
      <input
        required
        type="text"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[14px] text-clove-700 outline-none focus:border-saffron-400 focus:ring-2 focus:ring-saffron-400/20"
      />
      <input
        required
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[14px] text-clove-700 outline-none focus:border-saffron-400 focus:ring-2 focus:ring-saffron-400/20"
      />
      {error && <p className="font-sans text-xs text-paprika-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="h-11 rounded-xl bg-clove-700 font-sans text-[13.5px] font-semibold text-cream-50 hover:bg-clove-900 disabled:opacity-60"
      >
        {loading ? "Loading…" : "Start installment plan"}
      </button>
      <button
        type="button"
        onClick={() => setShowForm(false)}
        className="font-sans text-xs text-clove-400 hover:text-clove-600"
      >
        ← Back
      </button>
    </form>
  );
}
