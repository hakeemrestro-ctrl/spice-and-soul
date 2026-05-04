"use client";

import { useState } from "react";
import { Calendar, Users } from "lucide-react";

export function ReservationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          partySize,
          preferredDate: preferredDate || undefined,
          notes: notes || undefined,
        }),
      });
      if (res.ok) {
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="py-6 text-center">
        <div className="mb-3 text-4xl">🙏</div>
        <h2 className="mb-2 font-display text-2xl text-cream-50">Request received!</h2>
        <p className="font-sans text-sm text-clove-300">
          We&apos;ll confirm your table by phone or email within a few hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Full name"
        value={name}
        onChange={setName}
        required
        dark
      />
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        required
        dark
      />
      <Field
        label="Phone (optional)"
        type="tel"
        value={phone}
        onChange={setPhone}
        dark
      />

      {/* Party size */}
      <div>
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-cream-100">
          Party size
        </label>
        <div className="relative">
          <Users className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-clove-400" aria-hidden />
          <select
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
            className="w-full appearance-none rounded-[10px] border border-clove-600 bg-clove-800 py-2.5 pl-10 pr-3.5 font-sans text-[15px] text-cream-50 outline-none focus:border-saffron-400 focus:ring-2 focus:ring-saffron-400/20"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "person" : "people"}
              </option>
            ))}
            <option value={15}>13–15 people</option>
            <option value={20}>Large group (16+)</option>
          </select>
        </div>
      </div>

      {/* Preferred date */}
      <div>
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-cream-100">
          Preferred date <span className="text-clove-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-clove-400" aria-hidden />
          <input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full rounded-[10px] border border-clove-600 bg-clove-800 py-2.5 pl-10 pr-3.5 font-sans text-[15px] text-cream-50 outline-none focus:border-saffron-400 focus:ring-2 focus:ring-saffron-400/20"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="sm:col-span-2">
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-cream-100">
          Special requests <span className="text-clove-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Dietary requirements, occasion, seating preference…"
          className="w-full resize-none rounded-[10px] border border-clove-600 bg-clove-800 px-3.5 py-2.5 font-sans text-[15px] text-cream-50 outline-none placeholder:text-clove-500 focus:border-saffron-400 focus:ring-2 focus:ring-saffron-400/20"
        />
      </div>

      {status === "error" && (
        <p className="sm:col-span-2 font-sans text-sm text-paprika-400">
          Something went wrong. Please call us at +91 73 1245 6789.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="sm:col-span-2 h-12 rounded-xl bg-saffron-400 font-sans text-[15px] font-semibold text-clove-700 hover:bg-saffron-500 disabled:opacity-60"
      >
        {status === "loading" ? "Submitting…" : "Request a table"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  dark,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  dark?: boolean;
}) {
  return (
    <div>
      <label className={`mb-1.5 block font-sans text-[13px] font-medium ${dark ? "text-cream-100" : "text-clove-700"}`}>
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-[10px] border px-3.5 py-2.5 font-sans text-[15px] outline-none transition-shadow focus:ring-2 ${
          dark
            ? "border-clove-600 bg-clove-800 text-cream-50 placeholder:text-clove-500 focus:border-saffron-400 focus:ring-saffron-400/20"
            : "border-clove-200 bg-cream-0 text-clove-700 placeholder:text-clove-300 focus:border-2 focus:border-saffron-400 focus:ring-saffron-400/20"
        }`}
      />
    </div>
  );
}
