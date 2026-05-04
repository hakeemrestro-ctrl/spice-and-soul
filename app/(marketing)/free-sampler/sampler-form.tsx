"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export function SamplerForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      await fetch("/api/sampler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="py-4 text-center">
        <div className="mb-3 text-4xl">📬</div>
        <h2 className="mb-2 font-display text-2xl text-clove-700">Check your inbox!</h2>
        <p className="font-sans text-sm text-clove-500">
          Your 3-recipe sampler PDF is on its way. Should arrive within a minute.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">
          First name <span className="text-clove-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Priya"
          className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none transition-shadow placeholder:text-clove-300 focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">
          Email address
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none transition-shadow placeholder:text-clove-300 focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
        />
      </div>

      {status === "error" && (
        <p className="font-sans text-sm text-paprika-600">Something went wrong. Try again.</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-saffron-400 font-sans text-[15px] font-semibold text-clove-700 transition-colors hover:bg-saffron-500 disabled:opacity-60"
      >
        <Mail className="size-4" aria-hidden />
        {status === "loading" ? "Sending…" : "Send me the recipes"}
      </button>
    </form>
  );
}
