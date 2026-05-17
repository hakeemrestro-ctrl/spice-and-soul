"use client";

/**
 * Paytm legacy form-redirect embed.
 *
 * Server returns `{ action, fields }` where `action` is Paytm's
 * `/order/process` URL and `fields` is the signed hidden-input payload.
 *
 * Renders an invisible <form> + auto-submits on mount. Browser POSTs to
 * Paytm-hosted payment page; Paytm POSTs back to /api/paytm/callback when
 * done.
 *
 * Used while V2 All-in-One API access is being provisioned on the MID. Once
 * V2 is live, switch to txnToken + JS SDK flow.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

type Props = {
  orderId: string;
  amount: string;
  action: string;
  fields: Record<string, string>;
};

export default function PaytmCheckoutEmbed({ orderId, amount, action, fields }: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const submittedRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const propsError =
    !action || !fields || Object.keys(fields).length === 0
      ? "Payment session is missing details. Please refresh."
      : null;
  const error = propsError ?? submitError;

  useEffect(() => {
    if (submittedRef.current) return;
    if (propsError) return;
    if (!formRef.current) return;
    submittedRef.current = true;
    const t = setTimeout(() => {
      try {
        formRef.current?.submit();
      } catch (err) {
        console.error("Paytm form submit error:", err);
        setSubmitError("Could not redirect to Paytm. Please refresh and try again.");
      }
    }, 200);
    return () => clearTimeout(t);
  }, [propsError, action, fields]);

  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-50 p-6">
      {!error ? (
        <div className="flex items-center gap-3 font-sans text-sm text-clove-500">
          <Loader2 className="size-5 animate-spin text-saffron-500" aria-hidden />
          Redirecting to Paytm to pay ₹{amount} · Order {orderId.slice(0, 16)}…
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl bg-paprika-50 p-4 font-sans text-sm text-paprika-700">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="mb-1 font-medium">Payment couldn&apos;t start</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <form
        ref={formRef}
        method="POST"
        action={action}
        style={{ display: "none" }}
        aria-hidden="true"
      >
        {Object.entries(fields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      </form>
    </div>
  );
}
