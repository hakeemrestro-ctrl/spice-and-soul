"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type Props = {
  difficulties: string[];
  regions: string[];
};

export function CourseFilters({ difficulties, regions }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeDifficulty = searchParams.get("difficulty") ?? "";
  const activeRegion = searchParams.get("region") ?? "";

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (params.get(key) === value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`/courses?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  if (difficulties.length === 0 && regions.length === 0) return null;

  return (
    <div className="mb-10 flex flex-wrap items-center gap-3">
      {difficulties.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs font-semibold uppercase tracking-widest text-clove-400">
            Level
          </span>
          {difficulties.map((d) => (
            <button
              key={d}
              onClick={() => update("difficulty", d)}
              className={`rounded-full border px-3 py-1 font-sans text-xs font-medium transition-colors ${
                activeDifficulty === d
                  ? "border-saffron-400 bg-saffron-400 text-clove-900"
                  : "border-cream-200 bg-cream-50 text-clove-500 hover:border-saffron-300 hover:text-clove-700"
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      )}

      {regions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs font-semibold uppercase tracking-widest text-clove-400">
            Region
          </span>
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => update("region", r)}
              className={`rounded-full border px-3 py-1 font-sans text-xs font-medium transition-colors ${
                activeRegion === r
                  ? "border-paprika-400 bg-paprika-400 text-cream-50"
                  : "border-cream-200 bg-cream-50 text-clove-500 hover:border-paprika-200 hover:text-clove-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {(activeDifficulty || activeRegion) && (
        <button
          onClick={() => router.push("/courses", { scroll: false })}
          className="font-sans text-xs text-clove-400 underline-offset-2 hover:text-clove-600 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
