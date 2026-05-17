import { Check } from "lucide-react";

const STATIC_FEATURES = [
  "Lifetime access — yours forever",
  "Instant email delivery",
  "Re-send PDFs anytime",
  "PDF invoice included",
];

type Props = {
  recipeCount: number;
};

export function CourseFeatureList({ recipeCount }: Props) {
  const features = [`${recipeCount} authentic recipes`, ...STATIC_FEATURES];
  return (
    <ul className="mt-3 space-y-1.5 border-t border-cream-200 pt-3">
      {features.map((f) => (
        <li key={f} className="flex items-center gap-2 font-sans text-[13px] text-clove-500">
          <Check className="size-3.5 shrink-0 text-cardamom-600" aria-hidden />
          {f}
        </li>
      ))}
    </ul>
  );
}
