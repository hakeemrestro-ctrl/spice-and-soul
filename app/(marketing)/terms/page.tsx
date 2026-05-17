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
            By purchasing a course from Spice &amp; Soul Academy (operated by N K VENTURES,
            Shop No. 03, Plot No. 84, MP Nagar Zone II, Bhopal, Madhya Pradesh — 462016, India)
            you agree to these terms.
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
            All prices are in INR (Indian Rupees). Payment is processed securely by Paytm.
            We do not store card details. Prices may change at any time but confirmed
            purchases are honoured at the price paid. GST, where applicable, is included in
            the displayed price.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">5. Refunds</h2>
          <p>
            See our <a href="/refund-policy" className="text-paprika-600 underline">Refund Policy</a>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">6. Intellectual property</h2>
          <p className="mb-3">
            All content sold through Spice &amp; Soul Academy — including but not limited to
            recipe PDFs, photographs, instructional text, course structure, branding, and the
            Spice &amp; Soul Academy name and logo — is the exclusive intellectual property of
            N K VENTURES (Hakeem, Bhopal) and is protected under Indian copyright law and
            applicable international treaties.
          </p>
          <p className="mb-2 font-semibold text-clove-700">Your purchase grants you:</p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li>A personal, non-exclusive, non-transferable licence to use the purchased content for private household cooking</li>
            <li>The right to print one physical copy per purchase for personal kitchen use</li>
          </ul>
          <p className="mb-2 font-semibold text-clove-700">Your purchase does not grant you:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Ownership of any intellectual property rights in the content</li>
            <li>The right to reproduce, publish, broadcast, or create derivative works</li>
            <li>Any licence to use the Spice &amp; Soul Academy or Hakeem brand, name, or logo</li>
            <li>Permission to use the recipes or content for commercial purposes without a separate written agreement</li>
          </ul>
          <p className="mt-3">
            Unauthorised copying, reproduction, or distribution of our content may result in
            civil and criminal liability under the Indian Copyright Act, 1957.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">7. Limitation of liability</h2>
          <p className="mb-3">
            Spice &amp; Soul Academy and N K VENTURES provide all course content on an
            &ldquo;as is&rdquo; basis. While we take every care to ensure recipes are accurate
            and safe, cooking involves inherent risks including allergens, heat, and sharp
            implements. You are solely responsible for safe food handling practices in your
            own kitchen.
          </p>
          <p className="mb-2 font-semibold text-clove-700">We are not liable for:</p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li>Any personal injury, illness, or property damage arising from following our recipes</li>
            <li>Allergic reactions or dietary issues — always check ingredients against your own dietary requirements</li>
            <li>Any indirect, incidental, special, or consequential loss or damage</li>
            <li>Loss of data, revenue, or profits arising from use of or inability to use our content</li>
            <li>Errors, omissions, or inaccuracies in content, to the extent permitted by law</li>
          </ul>
          <p>
            In any event, our total liability to you shall not exceed the amount you paid for
            the relevant course at the time of purchase. Nothing in these terms limits
            liability for fraud, death, or personal injury caused by our negligence, as
            required by Indian law.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">8. Governing law</h2>
          <p>
            These terms are governed by the laws of India. Disputes shall be subject to the
            exclusive jurisdiction of the courts of Bhopal, Madhya Pradesh.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">9. Contact</h2>
          <p>
            <strong>hakeemrestro@gmail.com</strong>
            <br />
            Phone: <strong>+91 9406565799</strong>
            <br />
            N K VENTURES, Shop No. 03, Plot No. 84, MP Nagar Zone II, Bhopal, Madhya Pradesh — 462016
          </p>
        </section>
      </div>
    </main>
  );
}
