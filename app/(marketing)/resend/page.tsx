import type { Metadata } from "next";
import { Mail, Lock } from "lucide-react";
import { ResendForm } from "./resend-form";

export const metadata: Metadata = {
  title: "Re-send my course PDFs — Spice & Soul Academy",
  description:
    "Lost your purchase email? Enter your email to receive your recipe PDFs and invoice again.",
};

export default function ResendPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <div className="mb-8 inline-flex size-14 items-center justify-center rounded-2xl bg-saffron-100">
        <Mail className="size-7 text-saffron-600" aria-hidden />
      </div>

      <h1 className="mb-3 font-display text-4xl leading-tight text-clove-700">
        Re-send my{" "}
        <span className="italic text-paprika-600">PDFs</span>
      </h1>
      <p className="mb-8 font-sans text-[15px] leading-relaxed text-clove-500">
        Enter the email address you used at checkout. We&apos;ll send the recipe
        books and invoice for every course you&apos;ve purchased.
      </p>

      <ResendForm />

      <p className="mt-6 flex items-center gap-1.5 font-sans text-xs text-clove-400">
        <Lock className="size-3" aria-hidden />
        We only send PDFs to the email used at purchase.
      </p>
    </main>
  );
}
