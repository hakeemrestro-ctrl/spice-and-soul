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

type PaytmCheckoutJS = {
  init: (config: {
    root: string;
    flow: string;
    data: {
      orderId: string;
      token: string;
      tokenType: string;
      amount: string;
    };
    merchant: { mid: string; redirect: boolean };
    handler: {
      notifyMerchant: (event: string, data: unknown) => void;
      transactionStatus?: (data: unknown) => void;
    };
  }) => Promise<void>;
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
  const [scriptReady, setScriptReady] = useState(false);
  const invokedRef = useRef(false);

  const scriptSrc = `https://${host}/merchantpgpui/checkoutjs/merchants/${encodeURIComponent(mid)}.js`;

  useEffect(() => {
    if (!scriptReady || invokedRef.current) return;
    if (typeof window === "undefined") return;
    const Paytm = window.Paytm?.CheckoutJS;
    if (!Paytm) {
      setError("Paytm SDK did not load. Please refresh and try again.");
      return;
    }

    invokedRef.current = true;
    const config = {
      root: "",
      flow: "DEFAULT",
      data: {
        orderId,
        token: txnToken,
        tokenType: "TXN_TOKEN",
        amount,
      },
      merchant: { mid, redirect: false },
      handler: {
        notifyMerchant: (event: string, data: unknown) => {
          if (event === "APP_CLOSED") {
            onCancel?.();
          }
          console.info("[paytm:checkout] notifyMerchant", { event, data });
        },
        transactionStatus: (data: unknown) => {
          console.info("[paytm:checkout] transactionStatus", data);
        },
      },
    };

    Paytm.init(config)
      .then(() => Paytm.invoke())
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[paytm:checkout] init/invoke failed", msg);
        setError(`Could not start Paytm checkout: ${msg}`);
      });
  }, [scriptReady, orderId, mid, amount, txnToken, onCancel]);

  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-50 p-6">
      <Script
        src={scriptSrc}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setError("Failed to load Paytm SDK script.")}
      />
      <div id="paytm-checkout-root" />
      {!error ? (
        <div className="flex items-center gap-3 font-sans text-sm text-clove-500">
          <Loader2 className="size-5 animate-spin text-saffron-500" aria-hidden />
          {scriptReady
            ? `Opening Paytm to pay ₹${amount}…`
            : `Loading Paytm Checkout…`}
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl bg-paprika-50 p-4 font-sans text-sm text-paprika-700">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="mb-1 font-medium">Payment couldn&apos;t start</p>
            <p>{error}</p>
            <p className="mt-2 text-xs text-paprika-500">Order: {orderId.slice(0, 16)}…</p>
          </div>
        </div>
      )}
    </div>
  );
}
