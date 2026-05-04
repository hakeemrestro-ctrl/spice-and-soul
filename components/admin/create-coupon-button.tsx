"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  code: string;
  discountType: "percent" | "cents";
  discountValue: string;
  maxUses: string;
  expiresAt: string;
};

const DEFAULT: FormState = {
  code: "",
  discountType: "percent",
  discountValue: "",
  maxUses: "",
  expiresAt: "",
};

export function CreateCouponButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = parseFloat(form.discountValue);
    if (!form.code.trim() || isNaN(value) || value <= 0) {
      setError("Code and discount value are required");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          discountPercent: form.discountType === "percent" ? value : null,
          discountCents: form.discountType === "cents" ? Math.round(value * 100) : null,
          maxUses: form.maxUses ? parseInt(form.maxUses) : null,
          expiresAt: form.expiresAt || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create coupon");
        return;
      }
      setOpen(false);
      setForm(DEFAULT);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[10px] bg-clove-700 px-4 py-2 font-sans text-sm font-semibold text-cream-50 hover:bg-clove-900"
      >
        + New Coupon
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm rounded-2xl bg-cream-0 p-6 shadow-warm-lg"
          >
            <h2 className="mb-5 font-display text-xl text-clove-700">Create Coupon</h2>

            <label className="mb-1 block font-sans text-xs font-medium text-clove-700">Code</label>
            <input
              required
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              className="mb-4 w-full rounded-lg border border-clove-200 px-3 py-2 font-mono text-sm uppercase text-clove-700 focus:outline-none focus:ring-2 focus:ring-saffron-400"
            />

            <label className="mb-1 block font-sans text-xs font-medium text-clove-700">Discount type</label>
            <div className="mb-4 flex gap-3">
              {(["percent", "cents"] as const).map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-1.5 font-sans text-sm text-clove-600">
                  <input
                    type="radio"
                    name="discountType"
                    value={t}
                    checked={form.discountType === t}
                    onChange={() => set("discountType", t)}
                  />
                  {t === "percent" ? "Percentage (%)" : "Fixed amount ($)"}
                </label>
              ))}
            </div>

            <label className="mb-1 block font-sans text-xs font-medium text-clove-700">
              Value ({form.discountType === "percent" ? "%" : "$"})
            </label>
            <input
              required
              type="number"
              min={1}
              step={form.discountType === "cents" ? "0.01" : "1"}
              value={form.discountValue}
              onChange={(e) => set("discountValue", e.target.value)}
              className="mb-4 w-full rounded-lg border border-clove-200 px-3 py-2 font-sans text-sm text-clove-700 focus:outline-none focus:ring-2 focus:ring-saffron-400"
            />

            <label className="mb-1 block font-sans text-xs font-medium text-clove-700">
              Max uses <span className="text-clove-400 font-normal">(leave blank for unlimited)</span>
            </label>
            <input
              type="number"
              min={1}
              value={form.maxUses}
              onChange={(e) => set("maxUses", e.target.value)}
              className="mb-4 w-full rounded-lg border border-clove-200 px-3 py-2 font-sans text-sm text-clove-700 focus:outline-none focus:ring-2 focus:ring-saffron-400"
            />

            <label className="mb-1 block font-sans text-xs font-medium text-clove-700">
              Expires at <span className="text-clove-400 font-normal">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
              className="mb-5 w-full rounded-lg border border-clove-200 px-3 py-2 font-sans text-sm text-clove-700 focus:outline-none focus:ring-2 focus:ring-saffron-400"
            />

            {error && <p className="mb-3 font-sans text-xs text-paprika-600">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setOpen(false); setForm(DEFAULT); }}
                className="flex-1 rounded-lg border border-clove-200 py-2.5 font-sans text-sm text-clove-600 hover:bg-cream-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-lg bg-clove-700 py-2.5 font-sans text-sm font-semibold text-cream-50 hover:bg-clove-900 disabled:opacity-50"
              >
                {isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
