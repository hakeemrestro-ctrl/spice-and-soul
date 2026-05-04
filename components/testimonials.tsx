import { Star } from "lucide-react";

// Testimonial cards — 3-up on desktop, stacked on mobile.
// Hardcoded defaults can be overridden per page via props.

export type Testimonial = {
  quote: string;
  name: string;
  city: string;
  rating?: number;
};

type Props = {
  testimonials?: Testimonial[];
  heading?: string;
};

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I've cooked Indian food for years from books and YouTube. This is the first time my butter chicken tasted like a restaurant — the kasuri methi tip alone was worth the price.",
    name: "Sarah M.",
    city: "Brooklyn, NY",
    rating: 5,
  },
  {
    quote:
      "The biryani course is a masterclass. Hakeem walks you through the kacchi vs pakki technique like a patient uncle in your kitchen. My family asked where I bought it from.",
    name: "Arjun K.",
    city: "London, UK",
    rating: 5,
  },
  {
    quote:
      "Finally a sweets course that explains chhena properly. My rasgulla used to come out flat and rubbery — now they're spongy and double in size. Worth every dollar.",
    name: "Priya R.",
    city: "Toronto, CA",
    rating: 5,
  },
];

export function Testimonials({
  testimonials = DEFAULT_TESTIMONIALS,
  heading = "Loved by home cooks worldwide",
}: Props) {
  return (
    <section>
      <div className="eyebrow mb-3">REVIEWS</div>
      <h2 className="mb-6 font-display text-2xl text-clove-700">{heading}</h2>
      <div className="grid gap-5 sm:grid-cols-3">
        {testimonials.map((t, i) => (
          <article
            key={i}
            className="flex flex-col rounded-2xl border border-cream-200 bg-cream-50 p-5"
          >
            <div className="mb-3 flex items-center gap-0.5" aria-label={`${t.rating ?? 5} out of 5 stars`}>
              {Array.from({ length: t.rating ?? 5 }).map((_, j) => (
                <Star
                  key={j}
                  className="size-4 fill-saffron-400 text-saffron-400"
                  aria-hidden
                />
              ))}
            </div>
            <p className="mb-4 flex-1 font-sans text-[14px] leading-relaxed text-clove-600">
              &ldquo;{t.quote}&rdquo;
            </p>
            <footer className="border-t border-cream-200 pt-3">
              <p className="font-sans text-sm font-semibold text-clove-700">{t.name}</p>
              <p className="font-sans text-xs text-clove-400">{t.city}</p>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
