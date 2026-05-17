import Link from "next/link";
import Image from "next/image";
import { BookOpen, Check } from "lucide-react";
import type { Course } from "@/types";

const STATIC_FEATURES = [
  "Lifetime access — yours forever",
  "Instant email delivery",
  "Re-send PDFs anytime",
  "PDF invoice included",
];

type Props = {
  course: Course;
  /** Cents saved by buying the bundle vs. individuals. Only used when course.is_bundle. */
  bundleSavingsCents?: number;
  /** Cents-equivalent of the original (pre-bundle) price. Only used when course.is_bundle. */
  bundleOriginalCents?: number;
  isBestseller?: boolean;
  /** Pass true for above-the-fold cards to avoid LCP lazy-load penalty. */
  priority?: boolean;
  /** Render description excerpt + feature checklist inside the card footer. */
  showFeatures?: boolean;
};

const GRADIENTS = [
  "from-saffron-200 to-paprika-400",
  "from-saffron-300 to-saffron-700",
  "from-cardamom-100 to-cardamom-400",
  "from-paprika-200 to-paprika-600",
  "from-saffron-100 to-saffron-500",
] as const;

function pickGradient(slug: string): string {
  const code = slug.charCodeAt(0) || 0;
  return GRADIENTS[code % GRADIENTS.length];
}

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

export function CourseCard({ course, bundleSavingsCents, bundleOriginalCents, isBestseller = false, priority = false, showFeatures = false }: Props) {
  const isBundle = course.is_bundle;
  const priceDisplay = formatRupees(course.price_cents);
  const glyph = course.title.replace(/^[^a-zA-Z]*/, "").charAt(0).toUpperCase() || "·";

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={`group relative block h-full overflow-hidden rounded-2xl bg-card transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400 focus-visible:ring-offset-2 ${
        isBundle
          ? "border-[1.5px] border-saffron-400 shadow-warm-md hover:shadow-warm-lg"
          : "border border-border shadow-warm-sm hover:shadow-warm-lg"
      }`}
    >
      {isBundle && bundleSavingsCents != null && bundleSavingsCents > 0 && (
        <div className="absolute right-3.5 top-3.5 z-[2] whitespace-nowrap rounded-full bg-saffron-400 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-clove-700">
          Save {formatRupees(bundleSavingsCents)}
        </div>
      )}
      {!isBundle && isBestseller && (
        <div className="absolute right-3.5 top-3.5 z-[2] whitespace-nowrap rounded-full bg-paprika-400 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-cream-50">
          Bestseller
        </div>
      )}

      <div
        className={`relative flex h-44 items-center justify-center overflow-hidden ${
          isBundle ? "bg-clove-700" : `bg-gradient-to-br ${pickGradient(course.slug)}`
        }`}
      >
        {course.image_url ? (
          <Image
            src={course.image_url}
            alt={course.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />
        ) : isBundle ? (
          <div className="select-none font-display text-5xl italic leading-none text-cream-50">
            All 5
          </div>
        ) : (
          <div className="select-none font-display text-[120px] italic leading-none text-clove-700/[0.18]">
            {glyph}
          </div>
        )}
        {/* Overlay keeps text readable when image is set */}
        {course.image_url && (
          <div className="absolute inset-0 bg-gradient-to-t from-clove-900/60 to-transparent" />
        )}
        {!isBundle && (
          <div className="absolute left-3.5 top-3.5 z-[1] rounded-full bg-cream-50/90 px-2.5 py-1 font-sans text-[11px] font-semibold text-clove-700">
            {course.difficulty}
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="m-0 font-display text-2xl leading-tight text-clove-700">
          {course.title}
        </h3>
        <p className="mt-1.5 font-display text-[15px] italic leading-snug text-clove-500">
          {course.tagline}
        </p>
        <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
          <div className="font-sans text-xl font-bold text-clove-700">
            {priceDisplay}
            {isBundle && bundleOriginalCents != null && bundleOriginalCents > course.price_cents && (
              <span className="ml-2 text-sm font-normal text-clove-300 line-through">
                {formatRupees(bundleOriginalCents)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 font-sans text-xs text-clove-400">
            <BookOpen className="size-3.5" aria-hidden />
            {course.recipe_count} recipes
          </div>
        </div>

        {showFeatures && (
          <>
            {course.description && (
              <p className="mt-3 font-sans text-[13.5px] leading-relaxed text-clove-500 line-clamp-3">
                {course.description}
              </p>
            )}
            <ul className="mt-3 space-y-1.5 border-t border-cream-200 pt-3">
              {[`${course.recipe_count} authentic recipes`, ...STATIC_FEATURES].map((f) => (
                <li key={f} className="flex items-center gap-2 font-sans text-[13px] text-clove-500">
                  <Check className="size-3.5 shrink-0 text-cardamom-600" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Link>
  );
}
