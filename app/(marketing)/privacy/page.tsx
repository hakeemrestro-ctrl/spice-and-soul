import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Spice & Soul Academy",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="mb-2 font-display text-4xl text-clove-700">Privacy Policy</h1>
      <p className="mb-10 font-sans text-sm text-clove-400">Last updated: 1 May 2026</p>

      <div className="prose-clove space-y-8 font-sans text-[15px] leading-relaxed text-clove-600">
        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">1. Who we are</h2>
          <p>
            Spice &amp; Soul Academy is operated by N K VENTURES, a business registered in
            Bhopal, Madhya Pradesh, India (GST: 23CNEPK6523K1ZZ). Registered address: Shop No. 03,
            Plot No. 84, MP Nagar Zone II, Bhopal, Madhya Pradesh — 462016. References to
            &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo; mean N K VENTURES.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">2. What we collect</h2>
          <p>When you purchase a course we collect:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Your name and email address (entered at checkout)</li>
            <li>Payment details — processed and stored by Paytm Payment Services Pvt. Ltd.; we never see or store card numbers, UPI IDs, or wallet credentials</li>
            <li>Purchase record (course, amount, date) for invoicing and customer support</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">3. How we use it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Deliver your purchased recipe PDFs and invoice by email</li>
            <li>Re-send PDFs if you request it via <strong>/resend</strong></li>
            <li>Process refunds if requested within our 30-day guarantee period</li>
            <li>Comply with applicable tax and accounting obligations</li>
          </ul>
          <p className="mt-3">We do not sell your data to third parties.</p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">4. Third-party services</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Paytm Payment Services Pvt. Ltd.</strong> — payment processing (paytm.com/about-us/privacy-policy)</li>
            <li><strong>Resend</strong> — transactional email delivery (resend.com/privacy)</li>
            <li><strong>Supabase</strong> — database hosting on AWS infrastructure (supabase.com/privacy)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">5. Data retention</h2>
          <p>
            We retain order records for 7 years to comply with GST record-keeping requirements.
            Email addresses are retained as long as the associated order record exists.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">6. Your rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal data by
            emailing us. Deletion requests will be honoured except where retention is required
            by law (e.g. tax records).
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xl text-clove-700">7. Contact</h2>
          <p>
            Questions about this policy:{" "}
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
