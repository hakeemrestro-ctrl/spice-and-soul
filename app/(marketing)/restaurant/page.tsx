import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Phone,
  Star,
  ChefHat,
  Flame,
  Leaf,
  UtensilsCrossed,
  ArrowRight,
} from "lucide-react";
import { ReservationForm } from "@/components/reservation-form";

export const metadata: Metadata = {
  title: "Hakeem Restaurant — Authentic Indian Cuisine · Bhopal",
  description:
    "Hakeem Restaurant in Bhopal serves generations-old authentic Indian cuisine. Slow-cooked dals, signature biryanis, tandoor specialities, and royal Mughlai dishes.",
};

const DISHES = [
  {
    name: "Hakeem Dum Biryani",
    tag: "House Signature",
    tagVariant: "saffron" as const,
    description:
      "Aged basmati rice slow-cooked in a sealed deg with saffron, caramelised onions, and our 48-hour marinated protein. The recipe hasn't changed since 1971.",
    detail: "Serves 1 · Gluten-free · Dum-cooked 3 hrs",
    icon: Flame,
    courseSlug: "biryani-rice-dishes",
  },
  {
    name: "Murgh Makhani",
    tag: "All-time Favourite",
    tagVariant: "paprika" as const,
    description:
      "Tender chicken simmered overnight in a slow-roasted tomato and cream gravy. Richly spiced, never sharp — this is the butter chicken as it was meant to be.",
    detail: "Serves 1 · Pairs with naan",
    icon: ChefHat,
    courseSlug: "north-indian-classics",
  },
  {
    name: "Dal Makhani",
    tag: "24-Hour Dal",
    tagVariant: "cardamom" as const,
    description:
      "Black lentils and kidney beans simmered on a wood fire for a full 24 hours. Finished with cultured butter and a single ladle of cream. Pure, unforgettable.",
    detail: "Serves 2 · Vegetarian · Vegan available",
    icon: Leaf,
    courseSlug: "north-indian-classics",
  },
  {
    name: "Gilafi Seekh Kebab",
    tag: "Tandoor Classic",
    tagVariant: "saffron" as const,
    description:
      "Hand-minced lamb seekh wrapped in fresh bell pepper and onion, charred over scorching tandoor coal. Served with our house mint chutney and charred lemon.",
    detail: "2 pieces · High protein",
    icon: Flame,
    courseSlug: "street-food-chaat",
  },
  {
    name: "Nihari Gosht",
    tag: "Weekend Special",
    tagVariant: "paprika" as const,
    description:
      "A heritage Mughlai slow-braise of bone-in lamb cooked through the night with warm spices and marrow. Available Friday–Sunday only. Worth the wait.",
    detail: "Serves 1 · Friday–Sunday · Limited",
    icon: UtensilsCrossed,
    courseSlug: "north-indian-classics",
  },
  {
    name: "Shahi Tukda",
    tag: "Royal Dessert",
    tagVariant: "cardamom" as const,
    description:
      "Double-fried bread soaked in saffron rabri, crowned with silver leaf and crushed pistachios. A Mughlai court dessert — rich, floral, and completely indulgent.",
    detail: "Serves 1 · Vegetarian",
    icon: Star,
    courseSlug: "indian-sweets-desserts",
  },
];

const HOURS = [
  { day: "Mon – Thu", lunch: "12:00 – 3:30 pm", dinner: "7:00 – 11:00 pm" },
  { day: "Fri – Sat", lunch: "12:00 – 4:00 pm", dinner: "7:00 – 11:30 pm" },
  { day: "Sunday", lunch: "12:00 – 4:30 pm", dinner: "Closed" },
];

const TAG_STYLES = {
  saffron: "bg-saffron-100 text-saffron-700",
  paprika: "bg-paprika-50 text-paprika-700",
  cardamom: "bg-cardamom-100 text-cardamom-600",
};

const RESTAURANT_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "Hakeem Restaurant",
  description:
    "Three generations of kitchen wisdom. Heritage Mughlai recipes, slow-cooked biryanis, and tandoor classics in Bhopal since 1971.",
  url: "https://hakeemrestro.shop/restaurant",
  telephone: "+917552456789",
  servesCuisine: ["Indian", "Mughlai", "North Indian"],
  priceRange: "₹₹",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bhopal",
    addressRegion: "Madhya Pradesh",
    addressCountry: "IN",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      opens: "12:00",
      closes: "15:30",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      opens: "19:00",
      closes: "23:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Friday", "Saturday"],
      opens: "12:00",
      closes: "16:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Friday", "Saturday"],
      opens: "19:00",
      closes: "23:30",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Sunday"],
      opens: "12:00",
      closes: "16:30",
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "1200",
  },
};

export default function RestaurantPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(RESTAURANT_JSON_LD) }}
      />
      {/* ── Hero ─────────────────────────────────── */}
      <section className="relative overflow-hidden bg-clove-900 px-6 pb-24 pt-28 text-center">
        {/* Dot pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 bg-[url('/brand/dot-pattern.svg')] opacity-[0.12]"
          aria-hidden
        />
        {/* Saffron warm glow top */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[700px] -translate-x-1/2 rounded-full bg-saffron-400/10 blur-3xl"
          aria-hidden
        />

        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="eyebrow mb-5 text-saffron-400">
            BHOPAL · MADHYA PRADESH
          </div>
          <h1 className="mb-3 font-display text-[clamp(54px,8vw,88px)] leading-[1.04] tracking-tight text-cream-50">
            Hakeem
          </h1>
          <p className="mb-7 font-display text-2xl italic text-saffron-300">
            Authentic Indian Restaurant
          </p>
          <p className="mx-auto mb-10 max-w-xl font-sans text-base leading-relaxed text-clove-300">
            Three generations of kitchen wisdom. Heritage Mughlai recipes, slow-cooked biryanis, and tandoor classics — served in the heart of Bhopal since 1971.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="tel:+917552456789"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-saffron-400 px-7 font-sans text-base font-semibold text-clove-900 transition-colors hover:bg-saffron-500"
            >
              <Phone className="size-4" />
              Reserve a Table
            </a>
            <a
              href="#menu"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-clove-600 px-7 font-sans text-base font-semibold text-cream-50 transition-colors hover:border-saffron-400 hover:text-saffron-300"
            >
              View Menu
              <ArrowRight className="size-4" />
            </a>
          </div>

          {/* Trust bar */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 font-sans text-sm text-clove-400">
            <span className="flex items-center gap-1.5">
              <Star className="size-3.5 fill-saffron-400 text-saffron-400" />
              <Star className="size-3.5 fill-saffron-400 text-saffron-400" />
              <Star className="size-3.5 fill-saffron-400 text-saffron-400" />
              <Star className="size-3.5 fill-saffron-400 text-saffron-400" />
              <Star className="size-3.5 fill-saffron-400 text-saffron-400" />
              <span className="ml-1 text-clove-300">4.8 · 2,400+ reviews</span>
            </span>
            <span className="hidden sm:block text-clove-700">·</span>
            <span>Est. 1971 · 55 years of excellence</span>
            <span className="hidden sm:block text-clove-700">·</span>
            <span>N K VENTURES</span>
          </div>
        </div>
      </section>

      {/* ── Our Story ─────────────────────────────── */}
      <section className="border-b border-cream-200 bg-cream-50 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <div className="eyebrow mb-4">OUR STORY</div>
              <h2 className="mb-6 font-display text-[clamp(32px,4vw,48px)] leading-tight text-clove-800">
                A kitchen built on{" "}
                <span className="italic text-paprika-600">heritage.</span>
              </h2>
              <div className="space-y-4 font-sans text-base leading-relaxed text-clove-600">
                <p>
                  Hakeem began in 1971 when Ustad Hakeem opened a small corner kitchen in Bhopal&apos;s Chowk Bazaar — a single clay oven, a handful of hand-ground masalas, and recipes passed down four generations from a royal kitchen in Lucknow.
                </p>
                <p>
                  Today, under Naveed Khan and N K VENTURES, Hakeem carries that same spirit — the long slow cook, the respect for a single spice, the refusal to hurry what cannot be hurried. We still grind our own masalas. We still use the same dum method.
                </p>
                <p>
                  The Spice &amp; Soul Academy was born from this kitchen — so every student can carry these techniques home.
                </p>
              </div>
              <Link
                href="/courses"
                className="mt-8 inline-flex items-center gap-2 font-sans text-sm font-semibold text-saffron-600 no-underline hover:text-saffron-700"
              >
                Explore our cooking courses
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            {/* Visual aside — brand accent block */}
            <div className="relative">
              <div className="overflow-hidden rounded-3xl bg-clove-700 px-10 py-12 text-center">
                <div
                  className="pointer-events-none absolute inset-0 bg-[url('/brand/dot-pattern.svg')] opacity-[0.15]"
                  aria-hidden
                />
                <div className="relative z-10">
                  <div className="mb-3 font-display text-[80px] italic leading-none text-saffron-300/50">
                    H
                  </div>
                  <div className="font-display text-4xl italic text-cream-50">
                    Hakeem
                  </div>
                  <div className="mt-2 font-sans text-sm text-clove-300">
                    Bhopal · Since 1971
                  </div>
                  <div className="mx-auto mt-8 max-w-xs space-y-3 text-left">
                    {[
                      "Wood-fired tandoor",
                      "Hand-ground masalas daily",
                      "48-hour biryani marinade",
                      "No shortcuts. No compromises.",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2.5 font-sans text-sm text-clove-200">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-400" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Signature Menu ────────────────────────── */}
      <section id="menu" className="bg-cream-100 px-6 py-24 border-y border-cream-200">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="eyebrow mb-4">SIGNATURE DISHES</div>
            <h2 className="font-display text-[clamp(32px,4vw,52px)] leading-tight text-clove-800">
              Cooked with time. Served with{" "}
              <span className="italic text-saffron-600">care.</span>
            </h2>
            <p className="lead mx-auto mt-4 max-w-xl">
              Every dish on our menu is a slow process — not a fast one.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DISHES.map((dish) => {
              const Icon = dish.icon;
              return (
                <article
                  key={dish.name}
                  className="flex flex-col rounded-2xl bg-cream-0 p-6 shadow-[0_2px_12px_rgba(62,44,25,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(62,44,25,0.12)]"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-saffron-100">
                      <Icon className="size-5 text-saffron-600" />
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-wider ${TAG_STYLES[dish.tagVariant]}`}
                    >
                      {dish.tag}
                    </span>
                  </div>
                  <h3 className="mb-2 font-display text-xl text-clove-800">
                    {dish.name}
                  </h3>
                  <p className="mb-4 flex-1 font-sans text-sm leading-relaxed text-clove-600">
                    {dish.description}
                  </p>
                  <div className="mt-auto border-t border-cream-200 pt-3">
                    <div className="mb-2 font-mono text-[11px] text-clove-400">{dish.detail}</div>
                    <Link
                      href={`/courses/${dish.courseSlug}?utm_source=restaurant&utm_medium=dish-card`}
                      className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-saffron-600 no-underline hover:text-saffron-700"
                    >
                      Learn this dish →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-10 text-center font-sans text-sm text-clove-400">
            Full menu — starters, breads, desserts, and beverages — available in-restaurant &amp; on request.
          </p>
        </div>
      </section>

      {/* ── Dining Experience ─────────────────────── */}
      <section className="bg-cream-50 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="eyebrow mb-4">THE EXPERIENCE</div>
          <h2 className="mb-6 font-display text-[clamp(32px,4vw,48px)] leading-tight text-clove-800">
            More than a meal.
            <br />
            <span className="italic text-paprika-600">A tradition.</span>
          </h2>
          <p className="mx-auto mb-14 max-w-2xl font-sans text-base leading-relaxed text-clove-600">
            Hakeem seats 60 guests across two intimate rooms — the open kitchen counter and the private dining hall. We do not rush tables. A meal here is meant to last, linger, and leave you with something to talk about on the drive home.
          </p>

          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: Flame,
                title: "Live Tandoor",
                body: "Our open tandoor runs from noon to close. Watch the kebabs char and the bread puff — it is as much a show as it is a kitchen.",
              },
              {
                icon: Leaf,
                title: "Seasonal Produce",
                body: "Spices sourced from Khari Baoli, Delhi. Vegetables from Bhopal mandis, same-morning. Nothing from a packet. Nothing frozen.",
              },
              {
                icon: UtensilsCrossed,
                title: "Private Dining",
                body: "Host family dinners, corporate lunches, or intimate celebrations in our private hall. Call us to arrange a bespoke menu.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl bg-cream-100 p-7 text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-saffron-100">
                  <Icon className="size-6 text-saffron-600" />
                </div>
                <h3 className="mb-2 font-display text-xl text-clove-800">{title}</h3>
                <p className="font-sans text-sm leading-relaxed text-clove-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hours & Location ──────────────────────── */}
      <section className="border-t border-cream-200 bg-cream-100 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <div className="eyebrow mb-4">FIND US</div>
            <h2 className="font-display text-[clamp(28px,3.5vw,44px)] leading-tight text-clove-800">
              We&apos;re in Bhopal.{" "}
              <span className="italic text-clove-500">Come hungry.</span>
            </h2>
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            {/* Address */}
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-100">
                  <MapPin className="size-5 text-saffron-600" />
                </div>
                <div>
                  <div className="mb-1 font-sans text-xs font-semibold uppercase tracking-wider text-clove-500">
                    Address
                  </div>
                  <address className="not-italic font-sans text-sm leading-relaxed text-clove-700">
                    34, Siyaganj Market Road<br />
                    Near Rajwada Chowk<br />
                    Bhopal, Madhya Pradesh — 462 001<br />
                    India
                  </address>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-100">
                  <Phone className="size-5 text-saffron-600" />
                </div>
                <div>
                  <div className="mb-1 font-sans text-xs font-semibold uppercase tracking-wider text-clove-500">
                    Reservations
                  </div>
                  <a
                    href="tel:+917552456789"
                    className="font-sans text-sm text-clove-700 no-underline hover:text-saffron-600"
                  >
                    +91 731 245 6789
                  </a>
                  <p className="mt-0.5 font-sans text-xs text-clove-400">
                    Walk-ins welcome · Reservations recommended weekends
                  </p>
                </div>
              </div>

              {/* Company info */}
              <div className="rounded-xl border border-cream-200 bg-cream-0 p-5">
                <div className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-wider text-clove-400">
                  Business Details
                </div>
                <dl className="grid grid-cols-2 gap-3 font-sans text-xs">
                  <div>
                    <dt className="text-clove-400">Owner</dt>
                    <dd className="mt-0.5 font-medium text-clove-700">Naveed Khan</dd>
                  </div>
                  <div>
                    <dt className="text-clove-400">Company</dt>
                    <dd className="mt-0.5 font-medium text-clove-700">N K VENTURES</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-clove-400">GST Registration</dt>
                    <dd className="mt-0.5 font-mono text-[11px] font-medium tracking-wider text-clove-600">
                      23CNEPK6523K1ZZ
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Hours */}
            <div>
              <div className="flex gap-4 mb-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-100">
                  <Clock className="size-5 text-saffron-600" />
                </div>
                <div>
                  <div className="mb-1 font-sans text-xs font-semibold uppercase tracking-wider text-clove-500">
                    Opening Hours
                  </div>
                  <p className="font-sans text-xs text-clove-400">Kitchen closes 30 min before listed time</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-cream-200 bg-cream-0">
                {HOURS.map((h, i) => (
                  <div
                    key={h.day}
                    className={`px-5 py-4 font-sans text-sm ${
                      i < HOURS.length - 1 ? "border-b border-cream-200" : ""
                    }`}
                  >
                    <div className="mb-2 font-semibold text-clove-700">{h.day}</div>
                    <div className="flex gap-8 text-xs text-clove-500">
                      <span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-clove-400 mr-1.5">Lunch</span>
                        {h.lunch}
                      </span>
                      <span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-clove-400 mr-1.5">Dinner</span>
                        {h.dinner}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 font-sans text-xs text-clove-400">
                Closed on national holidays. Check our social pages for special occasion hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reservation Form ─────────────────────── */}
      <section className="bg-clove-900 px-6 py-24">
        <div className="mx-auto max-w-2xl">
          <div className="eyebrow mb-4 text-saffron-400">RESERVATIONS</div>
          <h2 className="mb-3 font-display text-[clamp(28px,4vw,44px)] leading-tight text-cream-50">
            Request a table
          </h2>
          <p className="mb-10 font-sans text-base leading-relaxed text-clove-300">
            Fill in your details and we&apos;ll confirm your reservation by phone or email. Or call us
            directly at{" "}
            <a href="tel:+917552456789" className="text-saffron-400 no-underline hover:underline">
              +91 731 245 6789
            </a>
            .
          </p>
          <ReservationForm />
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────── */}
      <section className="relative overflow-hidden bg-clove-800 px-6 py-24 text-center">
        <div
          className="pointer-events-none absolute inset-0 bg-[url('/brand/dot-pattern.svg')] opacity-[0.1]"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-xl">
          <div className="eyebrow mb-5 text-saffron-400">JOIN US</div>
          <h2 className="mb-5 font-display text-[clamp(32px,5vw,56px)] leading-tight text-cream-50">
            A table is waiting.{" "}
            <span className="italic text-saffron-300">Book yours.</span>
          </h2>
          <p className="mb-9 font-sans text-base leading-relaxed text-clove-300">
            Call to reserve or walk in. We keep a few tables free every evening — but weekends fill fast.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="tel:+917552456789"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-saffron-400 px-8 font-sans text-base font-semibold text-clove-900 transition-colors hover:bg-saffron-500"
            >
              <Phone className="size-4" />
              +91 731 245 6789
            </a>
            <Link
              href="/courses"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-clove-600 px-8 font-sans text-base font-semibold text-cream-50 transition-colors hover:border-saffron-400 hover:text-saffron-300"
            >
              Explore our courses
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
