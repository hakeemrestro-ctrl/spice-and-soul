import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — Spice & Soul Academy",
};

export default function RefundPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="mb-2 font-display text-4xl text-clove-700">Refund Policy</h1>
      <p className="mb-10 font-sans text-sm text-clove-400">Last updated: 1 May 2026</p>

      <div className="space-y-8 font-sans text-[15px] leading-relaxed text-clove-600">
        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">30-day money-back guarantee</h2>
          <p>
            If you are not satisfied with your purchase for any reason, contact us within
            <strong> 30 days</strong> of the purchase date for a full refund — no questions asked.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">How to request a refund</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Email <strong>support@spiceandsoul.com</strong> with the subject line
              &ldquo;Refund Request&rdquo;
            </li>
            <li>Include the email address used at checkout and your order/invoice number</li>
            <li>
              We will process the refund to your original payment method within
              <strong> 5–10 business days</strong>
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">Conditions</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Refund requests must be submitted within 30 days of purchase</li>
            <li>Refunds are issued to the original payment method only</li>
            <li>Upon refund, your licence to use the purchased content is revoked</li>
            <li>Bundle purchases are refunded in full — partial bundle refunds are not available</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">Exceptions</h2>
          <p>
            We reserve the right to decline a refund if there is evidence of policy abuse
            (e.g. repeated purchases and refunds of the same course).
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">Contact</h2>
          <p>
            <strong>support@spiceandsoul.com</strong>
          </p>
        </section>
      </div>
    </main>
  );
}
