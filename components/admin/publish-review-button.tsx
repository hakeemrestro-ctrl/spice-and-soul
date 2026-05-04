"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function PublishReviewButton({
  reviewId,
  published,
}: {
  reviewId: string;
  published: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handle = () => {
    startTransition(async () => {
      await fetch(`/api/admin/reviews/${reviewId}/publish`, { method: "POST" });
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={isPending}
      className={`rounded-md border px-2.5 py-1 font-sans text-xs font-medium disabled:opacity-50 ${
        published
          ? "border-paprika-200 text-paprika-600 hover:bg-paprika-50"
          : "border-cardamom-200 text-cardamom-600 hover:bg-cardamom-50"
      }`}
    >
      {isPending ? "…" : published ? "Unpublish" : "Publish"}
    </button>
  );
}
