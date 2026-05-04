"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

type Props = {
  /** Compact inline variant (above footer) vs full card */
  variant?: "inline" | "card";
};

export function NewsletterSignup({ variant = "card" }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      await fetch("/api/sampler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    if (variant === "inline") {
      return (
        <p className="font-sans text-sm text-cardamom-600 font-medium">
          ✓ Check your inbox — 3 free recipes on the way!
        </p>
      );
    }
    return (
      <div className="rounded-2xl border border-cream-200 bg-cream-50 p-6 text-center">
        <div className="mb-2 text-3xl">📬</div>
        <p className="font-display text-lg text-clove-700">Check your inbox!</p>
        <p className="mt-1 font-sans text-sm text-clove-500">Your free sampler PDF is on its way.</p>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="flex-1 rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2 font-sans text-sm text-clove-700 outline-none placeholder:text-clove-300 focus:border-saffron-400 focus:ring-2 focus:ring-saffron-400/20"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-clove-700 px-4 py-2 font-sans text-sm font-semibold text-cream-50 hover:bg-clove-900 disabled:opacity-60"
        >
          <Mail className="size-3.5" aria-hidden />
          {status === "loading" ? "…" : "Get free recipes"}
        </button>
      </form>
    );
  }

  return (
    <div className="rounded-2xl border border-saffron-200 bg-saffron-50/60 p-6">
      <div className="eyebrow mb-3 text-saffron-600">FREE · 3 RECIPES</div>
      <h3 className="mb-1 font-display text-xl text-clove-700">Get a free taste first</h3>
      <p className="mb-4 font-sans text-sm leading-relaxed text-clove-600">
        Drop your email and we&apos;ll send 3 authentic recipes from Hakeem&apos;s kitchen — instantly.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-[10px] border border-saffron-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none placeholder:text-clove-300 focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
        />
        {status === "error" && (
          <p className="font-sans text-xs text-paprika-600">Something went wrong. Try again.</p>
        )}
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-saffron-400 font-sans text-[13.5px] font-semibold text-clove-700 hover:bg-saffron-500 disabled:opacity-60"
        >
          <Mail className="size-4" aria-hidden />
          {status === "loading" ? "Sending…" : "Send me the recipes"}
        </button>
      </form>
      <p className="mt-2.5 font-sans text-[11px] text-clove-400 text-center">
        One email. No spam. No future marketing unless you buy.
      </p>
    </div>
  );
}
