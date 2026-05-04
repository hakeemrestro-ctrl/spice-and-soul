"use client";

import { useState } from "react";

export function ResendForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-cream-200 bg-cream-50 p-5">
        <p className="font-sans text-sm font-semibold text-clove-700">
          Check your inbox.
        </p>
        <p className="mt-1 font-sans text-sm text-clove-500">
          If <span className="font-medium">{email}</span> matches an order, your
          PDFs are on the way. Allow a minute or two for delivery.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="resend-email"
          className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700"
        >
          Email address
        </label>
        <input
          id="resend-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none transition-shadow focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
        />
      </div>
      {status === "error" && (
        <p className="font-sans text-sm text-paprika-600">
          Something went wrong. Try again in a moment.
        </p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-xl bg-clove-700 p-3.5 font-sans text-[15px] font-semibold text-cream-50 transition-colors hover:bg-clove-900 disabled:opacity-50"
      >
        {status === "loading" ? "Sending…" : "Send my PDFs"}
      </button>
    </form>
  );
}
