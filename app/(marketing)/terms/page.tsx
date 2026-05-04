import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Spice & Soul Academy",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="mb-2 font-display text-4xl text-clove-700">Terms of Service</h1>
      <p className="mb-10 font-sans text-sm text-clove-400">Last updated: 1 May 2026</p>

      <div className="space-y-8 font-sans text-[15px] leading-relaxed text-clove-600">
        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">1. Acceptance</h2>
          <p>
            By purchasing a course from Spice &amp; Soul Academy (operated by NK Ventures,
            Indore, India) you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">2. What you receive</h2>
          <p>
            Upon successful payment you receive a non-exclusive, non-transferable, personal
            licence to use the purchased recipe PDF(s) for your own household use. Course
            content is delivered by email as PDF attachments within minutes of purchase.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">3. Permitted use</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Cook the recipes at home for yourself and your household</li>
            <li>Print copies for your own kitchen use</li>
          </ul>
          <p className="mt-2 font-semibold text-clove-700">Not permitted:</p>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            <li>Sharing, reselling, or redistributing the PDFs</li>
            <li>Using recipes commercially (restaurant, catering, meal-kit services) without a separate commercial licence</li>
            <li>Uploading content to any platform or AI training dataset</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">4. Pricing &amp; payment</h2>
          <p>
            All prices are in USD. Payment is processed securely by Stripe. We do not store
            card details. Prices may change at any time but confirmed purchases are honoured
            at the price paid.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">5. Refunds</h2>
          <p>
            See our <a href="/refund-policy" className="text-paprika-600 underline">Refund Policy</a>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">6. Limitation of liability</h2>
          <p>
            We are not liable for any indirect, incidental, or consequential damages arising
            from your use of the course content. Our total liability shall not exceed the
            amount you paid for the relevant course.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">7. Governing law</h2>
          <p>
            These terms are governed by the laws of India. Disputes shall be subject to the
            exclusive jurisdiction of the courts of Indore, Madhya Pradesh.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">8. Contact</h2>
          <p>
            <strong>legal@spiceandsoul.com</strong> · NK Ventures, Indore, MP, India
          </p>
        </section>
      </div>
    </main>
  );
}
