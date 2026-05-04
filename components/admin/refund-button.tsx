"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefundButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleClick = () => {
    if (
      !confirm(
        "Refund this order? Customer access will be revoked and Stripe will return the full amount.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Refund failed");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-paprika-200 px-2.5 py-1 font-sans text-xs font-medium text-paprika-600 hover:bg-paprika-50 disabled:opacity-50"
      >
        {isPending ? "Refunding…" : "Refund"}
      </button>
      {error && (
        <span className="font-sans text-[11px] text-paprika-600">{error}</span>
      )}
    </div>
  );
}
