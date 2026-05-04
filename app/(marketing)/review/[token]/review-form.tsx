"use client";

import { useState } from "react";
import { Star } from "lucide-react";

type Props = {
  reviewId: string;
  token: string;
  defaultName: string;
};

export function ReviewForm({ reviewId, token, defaultName }: Props) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody] = useState("");
  const [name, setName] = useState(defaultName);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError("Please select a rating"); return; }
    setStatus("loading");
    setError(null);

    const res = await fetch("/api/reviews/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, token, rating, body: body.trim() || null, customerName: name }),
    });

    if (res.ok) {
      setStatus("done");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <div className="py-4 text-center">
        <div className="mb-3 text-4xl">🙏</div>
        <h2 className="mb-2 font-display text-2xl text-clove-700">Thank you!</h2>
        <p className="font-sans text-sm text-clove-500">
          Your review has been received. We&apos;ll publish it after a quick check.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Star rating */}
      <div>
        <label className="mb-2 block font-sans text-[13px] font-medium text-clove-700">
          Your rating
        </label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(i)}
              className="p-0.5 focus:outline-none"
              aria-label={`${i} star${i !== 1 ? "s" : ""}`}
            >
              <Star
                className={`size-7 transition-colors ${
                  i <= (hovered || rating)
                    ? "fill-saffron-400 text-saffron-400"
                    : "fill-none text-clove-200"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Review body */}
      <div>
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">
          Your review <span className="text-clove-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="What did you cook? What surprised you?"
          className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none resize-none transition-shadow placeholder:text-clove-300 focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
        />
      </div>

      {/* Name */}
      <div>
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">
          Name shown on review
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none transition-shadow placeholder:text-clove-300 focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
        />
      </div>

      {error && <p className="font-sans text-sm text-paprika-600">{error}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="h-12 rounded-xl bg-clove-700 font-sans text-[15px] font-semibold text-cream-50 hover:bg-clove-900 disabled:opacity-60"
      >
        {status === "loading" ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
