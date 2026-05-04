"use client";

import { useState } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { trackEvent } from "@/lib/plausible";

type Props = {
  priceCents: number;
};

function priceLabel(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function CheckoutForm({ priceCents }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setStatus("loading");
    trackEvent("checkout_paid", { price_cents: priceCents });
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/thank-you`,
      },
    });
    if (error) {
      setErrorMsg(error.message ?? "Payment failed");
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement />

      <div className="flex items-center justify-between rounded-xl bg-cream-100 p-4">
        <span className="font-sans text-sm text-clove-600">Total</span>
        <span className="font-display text-2xl text-clove-700">
          {priceLabel(priceCents)}
        </span>
      </div>

      {errorMsg && (
        <p className="font-sans text-sm text-paprika-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading" || !stripe}
        className="mt-1 rounded-xl bg-saffron-400 p-3.5 font-sans text-[15px] font-semibold text-clove-700 shadow-warm-md transition-colors hover:bg-saffron-500 disabled:opacity-50"
      >
        {status === "loading" ? "Processing…" : `Pay ${priceLabel(priceCents)}`}
      </button>
    </form>
  );
}
