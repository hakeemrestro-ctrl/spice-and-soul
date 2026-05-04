"use client";

import { useState, useTransition } from "react";

type Props = {
  coupon: {
    id: string;
    discount_percent: number | null;
    max_uses: number | null;
    expires_at: string | null;
  };
};

export function EditCouponButton({ coupon }: Props) {
  const [open, setOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(coupon.discount_percent?.toString() ?? "");
  const [maxUses, setMaxUses] = useState(coupon.max_uses?.toString() ?? "");
  const [expiresAt, setExpiresAt] = useState(
    coupon.expires_at ? new Date(coupon.expires_at).toISOString().slice(0, 10) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountPercent: discountPercent ? parseInt(discountPercent) : null,
          maxUses: maxUses ? parseInt(maxUses) : null,
          expiresAt: expiresAt || null,
        }),
      });
      if (res.ok) {
        setOpen(false);
        window.location.reload();
      } else {
        setError("Save failed — please try again.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-1.5 font-sans text-[12px] font-medium text-clove-600 transition-colors hover:bg-cream-100"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-clove-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 font-display text-xl text-clove-700">Edit Coupon</h2>

            <label className="mb-3 block">
              <span className="mb-1 block font-sans text-xs font-semibold uppercase tracking-wide text-clove-500">
                Discount %
              </span>
              <input
                type="number"
                min="1"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="w-full rounded-lg border border-cream-200 px-3 py-2 font-sans text-sm text-clove-700 focus:border-saffron-400 focus:outline-none"
                placeholder="e.g. 20"
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block font-sans text-xs font-semibold uppercase tracking-wide text-clove-500">
                Max uses (blank = unlimited)
              </span>
              <input
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="w-full rounded-lg border border-cream-200 px-3 py-2 font-sans text-sm text-clove-700 focus:border-saffron-400 focus:outline-none"
                placeholder="e.g. 100"
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-1 block font-sans text-xs font-semibold uppercase tracking-wide text-clove-500">
                Expires (blank = never)
              </span>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-cream-200 px-3 py-2 font-sans text-sm text-clove-700 focus:border-saffron-400 focus:outline-none"
              />
            </label>

            {error && (
              <p className="mb-3 font-sans text-xs text-paprika-600">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 rounded-lg bg-clove-700 py-2.5 font-sans text-sm font-semibold text-cream-50 hover:bg-clove-900"
              >
                Save
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-cream-200 py-2.5 font-sans text-sm text-clove-500 hover:bg-cream-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
