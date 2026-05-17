/**
 * GET /api/paytm/test-pay
 *
 * TEMPORARY ₹1 test page. Issues a real V2 txnToken from Paytm prod endpoint
 * + returns a self-contained HTML page that auto-launches the Paytm modal.
 *
 * Use to verify end-to-end V2 flow without going through the full checkout
 * form. DELETE this route after final verification.
 */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  PAYTM,
  generateOrderId,
  buildV2InitiatePayload,
  emailToCustId,
  auditPaytmConfig,
} from "@/lib/paytm";
import { createAdminClient } from "@/lib/supabase/admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

type PaytmInitiateResponse = {
  body?: {
    resultInfo?: { resultStatus?: string; resultCode?: string; resultMsg?: string };
    txnToken?: string;
  };
};

export async function GET() {
  let audit: Record<string, unknown>;
  try {
    audit = auditPaytmConfig();
  } catch (err) {
    return NextResponse.json(
      { error: "Paytm config not loadable", message: (err as Error).message },
      { status: 500 },
    );
  }

  // Use any published course for the order, but amount is ₹1.00 regardless.
  const supabase = createAdminClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("published", true)
    .limit(1)
    .single();
  if (!course) {
    return NextResponse.json({ error: "No published course found" }, { status: 500 });
  }

  const orderId = generateOrderId("TEST1");
  const email = "test-pay@hakeemrestro.shop";

  await supabase.from("pending_orders").insert({
    order_id: orderId,
    course_id: course.id,
    amount_cents: 100, // ₹1.00
    customer_email: email,
    customer_name: "Test Pay 1 Rupee",
    metadata: { courseTitle: course.title, isTestPay: "true" },
    status: "pending",
  });

  const callbackUrl = `${APP_URL}/api/paytm/callback`;
  const built = await buildV2InitiatePayload({
    orderId,
    amountRupees: "1.00",
    custId: emailToCustId(email),
    callbackUrl,
    email,
  });

  const paytmRes = await fetch(built.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(built.payload),
  });
  const paytmJson = (await paytmRes.json()) as PaytmInitiateResponse;
  const txnToken = paytmJson.body?.txnToken;
  const resultMsg = paytmJson.body?.resultInfo?.resultMsg;
  const resultCode = paytmJson.body?.resultInfo?.resultCode;

  if (!txnToken) {
    return NextResponse.json(
      {
        error: "Paytm rejected initiate",
        audit,
        paytm: { resultCode, resultMsg },
      },
      { status: 502 },
    );
  }

  const mid = PAYTM.mid;
  const host = PAYTM.host;
  const scriptSrc = `https://${host}/merchantpgpui/checkoutjs/merchants/${encodeURIComponent(mid)}.js`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Paytm ₹1 Test Pay</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; }
  pre  { background: #f4f4f4; padding: 12px; border-radius: 6px; font-size: 12px; overflow: auto; }
  .ok  { color: #0a7; } .err { color: #c33; }
</style>
</head>
<body>
  <h1>Paytm ₹1.00 Test Payment</h1>
  <p>Order: <code>${orderId}</code> &middot; Token: <code>${txnToken.slice(0, 16)}...</code></p>
  <p id="status">Loading Paytm SDK…</p>
  <pre id="log"></pre>

  <script>
    var logEl = document.getElementById("log");
    var statusEl = document.getElementById("status");
    function log(msg) { logEl.textContent += msg + "\\n"; console.log(msg); }
    function setStatus(msg, ok) { statusEl.textContent = msg; statusEl.className = ok ? "ok" : "err"; }
    function onScriptLoad() {
      log("script loaded; hasCheckoutJS=" + !!(window.Paytm && window.Paytm.CheckoutJS));
      if (!window.Paytm || !window.Paytm.CheckoutJS) {
        setStatus("Paytm SDK didn't load", false);
        return;
      }
      var config = {
        root: "",
        flow: "DEFAULT",
        data: {
          orderId: "${orderId}",
          token: "${txnToken}",
          tokenType: "TXN_TOKEN",
          amount: "1.00"
        },
        handler: {
          notifyMerchant: function(event, data) {
            log("notifyMerchant " + event + ": " + JSON.stringify(data));
            if (event === "APP_CLOSED") setStatus("User closed checkout", false);
          },
          transactionStatus: function(data) {
            log("transactionStatus: " + JSON.stringify(data));
          }
        }
      };
      window.Paytm.CheckoutJS.onLoad(function() {
        log("CheckoutJS.onLoad fired; calling init…");
        var p = window.Paytm.CheckoutJS.init(config);
        if (p && typeof p.then === "function") {
          p.then(function() {
            log("init resolved; calling invoke()");
            try { window.Paytm.CheckoutJS.invoke(); setStatus("Modal launched", true); }
            catch (e) { log("invoke threw: " + e.message); setStatus("invoke failed: " + e.message, false); }
          }).catch(function(err) {
            log("init rejected: " + (err && err.message || JSON.stringify(err)));
            setStatus("init failed: " + (err && err.message || JSON.stringify(err)), false);
          });
        } else {
          log("init returned non-Promise; invoking directly");
          window.Paytm.CheckoutJS.invoke();
        }
      });
    }
  </script>

  <script type="application/javascript"
          src="${scriptSrc}"
          crossorigin="anonymous"
          onload="onScriptLoad()"
          onerror="setStatus('SDK script failed to load (network or 4xx)', false)"></script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
