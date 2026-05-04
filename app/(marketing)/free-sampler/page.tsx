import type { Metadata } from "next";
import { SamplerForm } from "./sampler-form";

export const metadata: Metadata = {
  title: "Free Recipe Sampler — Spice & Soul Academy",
  description:
    "Get 3 authentic Indian recipes from Hakeem's kitchen, delivered free to your inbox. No account needed.",
};

export default function FreeSamplerPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      {/* Eyebrow */}
      <div className="eyebrow mb-4 text-saffron-500">FREE · INSTANT DELIVERY</div>

      <h1 className="mb-3 font-display text-[clamp(36px,5vw,52px)] leading-[1.05] text-clove-700">
        3 recipes from<br />Hakeem&apos;s kitchen
      </h1>
      <p className="mb-8 font-display text-xl italic leading-snug text-clove-500">
        A free taste before you dive in.
      </p>
      <p className="mb-8 font-sans text-[15px] leading-relaxed text-clove-600">
        Enter your email and we&apos;ll send a 3-recipe sampler PDF — straight from the Hakeem&apos;s
        recipe archive. No account, no card, no strings.
      </p>

      <div className="rounded-2xl border border-cream-200 bg-cream-50 p-7 shadow-warm-sm">
        <SamplerForm />
      </div>

      <p className="mt-5 text-center font-sans text-xs text-clove-400">
        One email only. No newsletter unless you buy a course.
      </p>
    </main>
  );
}
