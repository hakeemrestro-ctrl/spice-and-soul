"use client";

/**
 * Paytm V2 All-in-One JS Checkout embed.
 *
 * Loads Paytm's hosted JS SDK from
 *   https://{host}/merchantpgpui/checkoutjs/merchants/{MID}.js
 * configures it with the server-issued txnToken, and opens the payment modal.
 *
 * Host pattern (Paytm Payments Services Ltd accounts):
 *   production → secure.paytmpayments.com
 *   staging    → securestage.paytmpayments.com
 */
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Loader2, AlertTriangle } from "lucide-react";

type Props = {
  orderId: string;
  mid: string;
  amount: string;
  txnToken: string;
  host: string; // e.g. "secure.paytmpayments.com"
  onCancel?: () => void;
};

type PaytmCheckoutConfig = {
  root: string;
  flow: string;
  data: {
    orderId: string;
    token: string;
    tokenType: string;
    amount: string;
  };
  handler: {
    notifyMerchant: (event: string, data: unknown) => void;
    transactionStatus?: (data: unknown) => void;
  };
};

type PaytmCheckoutJS = {
  onLoad: (cb: () => void) => void;
  init: (config: PaytmCheckoutConfig) => Promise<void> | undefined;
  invoke: () => void;
};

declare global {
  interface Window {
    Paytm?: { CheckoutJS?: PaytmCheckoutJS };
  }
}

export default function PaytmCheckoutEmbed({
  orderId,
  mid,
  amount,
  txnToken,
  host,
  onCancel,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const invokedRef = useRef(false);
  const succeededRef = useRef(false);
  // Stable ref to latest onCancel so the useEffect (and MutationObserver
  // inside it) doesn't tear down on every parent render. The previous
  // implementation listed `onCancel` in deps and parents pass an inline
  // arrow each render → useEffect cleanup disconnected the observer
  // immediately, killing the cancel-detection fallback.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const scriptSrc = `https://${host}/merchantpgpui/checkoutjs/merchants/${encodeURIComponent(mid)}.js`;

  useEffect(() => {
    if (!scriptReady || invokedRef.current) return;
    if (typeof window === "undefined") return;
    if (!window.Paytm?.CheckoutJS) {
      setError("Paytm SDK did not load. Please refresh and try again.");
      return;
    }

    invokedRef.current = true;

    // Fallback cancellation detector: if Paytm SDK removes its #paytm-app
    // container from DOM (which it does on close), treat as cancellation.
    // Some Paytm V2 builds don't fire APP_CLOSED reliably on user-initiated
    // close — this MutationObserver catches those cases.
    //
    // Guarded by succeededRef so the observer does NOT misfire when Paytm
    // tears down its DOM during a successful transactionStatus → /thank-you
    // navigation (false-cancel race).
    let paytmMounted = false;
    const observer = new MutationObserver(() => {
      if (succeededRef.current) {
        observer.disconnect();
        return;
      }
      const stillThere = document.getElementById("paytm-app");
      if (stillThere) {
        paytmMounted = true;
        return;
      }
      if (paytmMounted) {
        // Modal was rendered then removed without a success state.
        console.info("[paytm:checkout] DOM-cancel detector fired");
        observer.disconnect();
        setCancelled(true);
        onCancelRef.current?.();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const config: PaytmCheckoutConfig = {
      root: "",
      flow: "DEFAULT",
      data: {
        orderId,
        token: txnToken,
        tokenType: "TXN_TOKEN",
        amount,
      },
      handler: {
        notifyMerchant: (event: string, data: unknown) => {
          console.info("[paytm:checkout] notifyMerchant", { event, data });
          if (event === "APP_CLOSED") {
            setCancelled(true);
            onCancelRef.current?.();
            return;
          }
          if (event === "SESSION_EXPIRED") {
            setError("Payment session expired. Start checkout again.");
            return;
          }
          if (event.endsWith("_ERROR")) {
            setError(`Paytm error: ${event}`);
          }
        },
        transactionStatus: (data: unknown) => {
          console.info("[paytm:checkout] transactionStatus", data);
          const d = (data ?? {}) as { STATUS?: string; TXNID?: string; RESPMSG?: string };
          if (d.STATUS === "TXN_SUCCESS" && d.TXNID) {
            // Flag success BEFORE Paytm tears down its DOM, so the
            // MutationObserver doesn't misread the teardown as a cancel.
            succeededRef.current = true;
            observer.disconnect();
            window.location.assign(`/thank-you?payment_intent=${encodeURIComponent(d.TXNID)}`);
            return;
          }
          if (d.STATUS === "TXN_FAILURE") {
            setError(`Payment failed: ${d.RESPMSG ?? "transaction declined"}`);
            return;
          }
          if (d.STATUS && d.STATUS !== "PENDING") {
            // Catch-all for unexpected terminal states (other than PENDING which
            // resolves later). Surface so user isn't stuck on the spinner.
            setError(`Unexpected payment status: ${d.STATUS}`);
          }
        },
      },
    };

    // V2 SDK requires onLoad wrapper because init/invoke are attached
    // asynchronously after script load. Call methods via the global so `this`
    // binding inside the SDK is correct (storing a reference like
    // `const Paytm = window.Paytm.CheckoutJS` and calling `Paytm.init()`
    // loses `this` and triggers "init is not a function").
    window.Paytm.CheckoutJS.onLoad(function executeAfterCompleteLoad() {
      try {
        const initResult = window.Paytm!.CheckoutJS!.init(config);
        if (initResult && typeof initResult.then === "function") {
          initResult
            .then(() => {
              window.Paytm!.CheckoutJS!.invoke();
            })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("[paytm:checkout] init/invoke failed", msg);
              setError(`Could not start Paytm checkout: ${msg}`);
            });
        } else {
          // Some SDK builds invoke synchronously. Fallback path.
          window.Paytm!.CheckoutJS!.invoke();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[paytm:checkout] init threw synchronously", msg);
        setError(`Could not start Paytm checkout: ${msg}`);
      }
    });

    return () => {
      observer.disconnect();
    };
    // onCancel intentionally NOT in deps — we read it via onCancelRef. Listing
    // it caused the effect (and observer) to tear down every parent render
    // since parents pass an inline arrow as onCancel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, orderId, mid, amount, txnToken]);

  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-50 p-6">
      <Script
        src={scriptSrc}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setError("Failed to load Paytm SDK script.")}
      />
      <div id="paytm-checkout-root" />
      {error ? (
        <div className="flex items-start gap-3 rounded-xl bg-paprika-50 p-4 font-sans text-sm text-paprika-700">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="mb-1 font-medium">Payment couldn&apos;t complete</p>
            <p>{error}</p>
            <p className="mt-2 text-xs text-paprika-500">Order: {orderId.slice(0, 16)}…</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCancelled(false);
                onCancel?.();
              }}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-paprika-600 px-4 py-2 text-sm font-medium text-white hover:bg-paprika-700"
            >
              Try again
            </button>
          </div>
        </div>
      ) : cancelled ? (
        <div className="flex items-start gap-3 rounded-xl bg-cream-100 p-4 font-sans text-sm text-clove-700">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-saffron-500" aria-hidden />
          <div className="flex-1">
            <p className="mb-1 font-medium">Payment cancelled</p>
            <p className="text-clove-500">You closed the Paytm window. No charge was made.</p>
            <p className="mt-2 text-xs text-clove-400">Order: {orderId.slice(0, 16)}…</p>
            <button
              type="button"
              onClick={() => {
                setCancelled(false);
                onCancel?.();
              }}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-clove-700 px-4 py-2 text-sm font-medium text-white hover:bg-clove-800"
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 font-sans text-sm text-clove-500">
          <Loader2 className="size-5 animate-spin text-saffron-500" aria-hidden />
          {scriptReady
            ? `Opening Paytm to pay ₹${amount}…`
            : `Loading Paytm Checkout…`}
        </div>
      )}
    </div>
  );
}
