"use client";

import { useState, useTransition } from "react";

const STATUSES = ["new", "confirmed", "seated", "no-show", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const COLOR: Record<Status, string> = {
  new: "bg-saffron-100 text-saffron-700",
  confirmed: "bg-cardamom-100 text-cardamom-700",
  seated: "bg-cream-200 text-clove-700",
  "no-show": "bg-paprika-100 text-paprika-700",
  cancelled: "bg-cream-100 text-clove-400",
};

export function ReservationStatusSelect({
  reservationId,
  currentStatus,
}: {
  reservationId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState<Status>(
    STATUSES.includes(currentStatus as Status) ? (currentStatus as Status) : "new"
  );
  const [, startTransition] = useTransition();

  function handleChange(next: Status) {
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const res = await fetch(`/api/admin/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) setStatus(prev);
    });
  }

  return (
    <select
      value={status}
      onChange={(e) => handleChange(e.target.value as Status)}
      className={`rounded-full border-0 px-2.5 py-1 font-sans text-[11px] font-semibold outline-none ring-1 ring-transparent focus:ring-saffron-400 ${COLOR[status]}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}
