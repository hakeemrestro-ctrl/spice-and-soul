import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, Utensils, HeartHandshake, ShieldCheck, Flame, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export const metadata: Metadata = {
  title: "About Hakeem | A Legacy of Taste Since 1971",
  description:
    "Discover the story of Hakeem, a family food legacy since 1971, built across three generations around authentic flavours, quality ingredients and warm hospitality.",
  metadataBase: new URL(BASE),
  openGraph: {
    title: "About Hakeem | A Legacy of Taste Since 1971",
    description:
      "Discover the story of Hakeem, a family food legacy since 1971, built across three generations around authentic flavours, quality ingredients and warm hospitality.",
    type: "website",
    url: `${BASE}/about-us`,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "About Hakeem" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Hakeem | A Legacy of Taste Since 1971",
    description:
      "Discover the story of Hakeem, a family food legacy since 1971, built across three generations around authentic flavours, quality ingredients and warm hospitality.",
    images: ["/opengraph-image"],
  },
};

const TIMELINE = [
  {
    year: "1971",
    badge: "THE BEGINNING",
    title: "The First Clay Oven",
    body: "A family-run food business built around a love for good food. Ustad Hakeem begins cooking with hand-ground masalas and royal Lucknow techniques in Bhopal.",
  },
  {
    year: "SECOND GENERATION",
    badge: "THE LEGACY CONTINUES",
    title: "Mastering the Craft",
    body: "Traditional recipes, values and hospitality carried forward. The reputation grows as our signature dum biryanis and slow-simmered gravies become celebrated staples.",
  },
  {
    year: "THIRD GENERATION",
    badge: "A NEW CHAPTER",
    title: "Evolving With Changing Tastes",
    body: "A new generation builds on the foundation of those before them, pairing time-tested kitchen discipline with modern culinary standards and broader reach.",
  },
  {
    year: "TODAY",
    badge: "THE JOURNEY CONTINUES",
    title: "Living Heritage",
    body: "Tradition meets new ideas. Serving thousands of dining guests in Bhopal while sharing authentic kitchen techniques with home cooks across the world through the Academy.",
  },
];

const PHILOSOPHY = [
  {
    title: "AUTHENTICITY",
    tagline: "Preserved Heritage",
    description: "Traditional flavours, carefully preserved and thoughtfully prepared.",
    icon: Flame,
  },
  {
    title: "QUALITY",
    tagline: "Uncompromised Standards",
    description: "Quality ingredients are at the heart of every dish.",
    icon: Sparkles,
  },
  {
    title: "CRAFT",
    tagline: "Patience & Technique",
    description: "Time-tested recipes and careful preparation create consistency.",
    icon: Utensils,
  },
  {
    title: "HOSPITALITY",
    tagline: "Warmth in Every Welcome",
    description: "Because great food becomes memorable when shared with warmth.",
    icon: HeartHandshake,
  },
];

const PROMISES = [
  {
    num: "01",
    title: "Authentic & Delicious Flavours",
    body: "True to their historical roots, cooked with balance, aromatic depth, and never cut short.",
  },
  {
    num: "02",
    title: "Quality Ingredients",
    body: "Whole spices stone-ground daily, aged basmati grains, pure ghee, and fresh local produce.",
  },
  {
    num: "03",
    title: "Consistent Taste & Preparation",
    body: "Exact spice measures, slow dum heat control, and decades of recipe refinement for dependable perfection.",
  },
  {
    num: "04",
    title: "Hygienic Food Practices",
    body: "Immaculate kitchen hygiene, meticulous ingredient handling, and modern culinary safety standards.",
  },
  {
    num: "05",
    title: "Warm & Welcoming Hospitality",
    body: "Treating every guest like family, with genuine warmth, attention, and generous Bhopal courtesy.",
  },
  {
    num: "06",
    title: "Memorable Dining Experiences",
    body: "Food that creates nostalgia, sparks conversation, and lingers in your memory long after the meal.",
  },
];

const ABOUT_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Hakeem — A Legacy of Taste Since 1971",
  description:
    "Discover the story of Hakeem, a family food legacy since 1971, built across three generations around authentic flavours, quality ingredients and warm hospitality.",
  url: `${BASE}/about-us`,
  mainEntity: {
    "@type": "Restaurant",
    name: "Hakeem",
    foundingDate: "1971",
    founder: {
      "@type": "Person",
      name: "Ustad Hakeem",
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: "Shop No. 03, Plot No. 84, MP Nagar Zone II",
      addressLocality: "Bhopal",
      addressRegion: "Madhya Pradesh",
      postalCode: "462016",
      addressCountry: "IN",
    },
    servesCuisine: ["Indian", "Mughlai", "North Indian"],
  },
};

export default function AboutUsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ABOUT_JSON_LD) }}
      />

      {/* ── SECTION 1 — HERO ─────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-cream-50 via-saffron-50/40 to-cream-50 px-6 pb-20 pt-20 sm:pb-28 sm:pt-24 border-b border-cream-200">
        {/* Subtle dot pattern overlay matching homepage and restaurant */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/brand/dot-pattern.svg')] opacity-40"
        />
        {/* Ambient warm glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-64 w-[600px] -translate-x-1/2 rounded-full bg-saffron-400/15 blur-3xl"
        />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="eyebrow mb-4 motion-safe:animate-fade-in">
            SINCE 1971
          </div>

          <h1 className="mb-4 font-display text-[clamp(44px,6.5vw,76px)] leading-[1.05] tracking-tight text-clove-700 motion-safe:animate-slide-up motion-safe:delay-75">
            About Hakeem
          </h1>

          <p className="mx-auto mb-6 font-display text-[clamp(22px,3.2vw,36px)] italic leading-tight text-paprika-600 motion-safe:animate-slide-up motion-safe:delay-150">
            A Legacy of Taste Since 1971
          </p>

          <p className="mx-auto mb-10 max-w-2xl font-sans text-lg leading-relaxed text-clove-600 motion-safe:animate-slide-up motion-safe:delay-225">
            For over five decades, Hakeem has been a name associated with authentic flavours, quality ingredients and the love of good food.
          </p>

          {/* Opening Chapter Visual Vignette */}
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-cream-200 bg-cream-0 shadow-warm-md motion-safe:animate-slide-up motion-safe:delay-300">
            <div className="relative aspect-[21/9] w-full overflow-hidden sm:aspect-[2.4/1]">
              <Image
                src="https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=1200&q=80"
                alt="Clay ovens, spices and traditional culinary craft at Hakeem"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 800px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-clove-900/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between text-left text-cream-50">
                <div>
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-saffron-300">
                    Bhopal, India
                  </span>
                  <p className="font-display text-lg text-cream-50 sm:text-xl">
                    Five decades of wood fire, clay oven &amp; slow-cooked heritage.
                  </p>
                </div>
                <div className="hidden shrink-0 rounded-full border border-cream-50/20 bg-clove-900/40 px-3 py-1 font-mono text-[11px] text-cream-100 backdrop-blur-sm sm:block">
                  Est. 1971
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — THE BEGINNING ─────────────────────────── */}
      <section className="relative border-b border-cream-200 bg-cream-50 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            {/* Visual Focal Point: 1971 */}
            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-3xl border border-cream-200 bg-gradient-to-br from-cream-100 to-saffron-50/60 p-8 sm:p-12 text-center lg:text-left">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 font-display text-[180px] leading-none text-clove-900/[0.04] select-none"
                >
                  71
                </div>

                <div className="eyebrow mb-2 text-saffron-600">THE BEGINNING</div>
                <div className="font-display text-[clamp(76px,12vw,140px)] font-normal leading-none tracking-tighter text-clove-800">
                  1971
                </div>
                <div className="mt-4 font-display text-xl italic text-clove-600">
                  Where the journey started.
                </div>
                <div className="mt-6 flex items-center justify-center lg:justify-start gap-2 text-xs font-semibold uppercase tracking-wider text-clove-400">
                  <span>Bhopal</span>
                  <span>·</span>
                  <span>Chowk Bazaar</span>
                  <span>·</span>
                  <span>One Clay Oven</span>
                </div>
              </div>
            </div>

            {/* Story Text + Imagery */}
            <div className="lg:col-span-7">
              <div className="eyebrow mb-3">ORIGIN STORY</div>
              <h2 className="mb-6 font-display text-[clamp(32px,4vw,46px)] leading-tight text-clove-700">
                Where the Hakeem story began.
              </h2>

              <div className="space-y-5 font-sans text-[16.5px] leading-relaxed text-clove-600">
                <p>
                  Founded in 1971, Hakeem began as a family-run food business and has proudly continued its journey through three generations.
                </p>
                <p>
                  What started with a passion for serving delicious food has grown into a trusted restaurant brand, while keeping the same values of taste, quality and hospitality at its heart.
                </p>
                <p>
                  From that single corner kitchen with hand-ground masalas and royal Lucknow-style slow cooking, every recipe was crafted to withstand the test of time — never taking shortcuts, never compromising on patience.
                </p>
              </div>

              {/* Accent citation rule */}
              <div className="mt-8 border-l-2 border-saffron-400 pl-4">
                <p className="font-display italic text-lg text-clove-600">
                  “The recipe hasn’t changed because the truth in good food doesn’t change.”
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — THREE GENERATIONS (TIMELINE) ─────────── */}
      <section className="relative border-b border-cream-200 bg-cream-100 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <div className="eyebrow mb-3">HERITAGE ACROSS DECADES</div>
            <h2 className="mb-5 font-display text-[clamp(32px,4vw,50px)] leading-tight text-clove-700">
              Three Generations.<br className="hidden sm:inline" /> One Continuing Story.
            </h2>
            <div className="mx-auto max-w-2xl space-y-4 font-sans text-base leading-relaxed text-clove-600">
              <p>
                From our humble beginnings in 1971 to serving guests today, our journey has been built on the trust and love of our customers.
              </p>
              <p>
                As the third generation of the family, we continue to carry forward the legacy while constantly evolving with changing tastes, modern standards and new ideas.
              </p>
            </div>
          </div>

          {/* Vertical Timeline */}
          <div className="relative">
            {/* Continuous thin connecting line */}
            <div
              aria-hidden
              className="absolute left-4 top-4 bottom-4 w-[2px] bg-gradient-to-b from-saffron-400 via-saffron-300 to-cream-300 sm:left-1/2 sm:-translate-x-1/2"
            />

            <div className="space-y-12 sm:space-y-16">
              {TIMELINE.map((item, index) => {
                const isEven = index % 2 === 0;
                return (
                  <div
                    key={item.year}
                    className="relative flex flex-col sm:flex-row items-start"
                  >
                    {/* Timeline Node Marker */}
                    <div className="absolute left-4 top-1.5 -translate-x-1/2 z-10 sm:left-1/2">
                      <div className="flex size-7 items-center justify-center rounded-full border-2 border-saffron-400 bg-cream-50 shadow-warm-xs">
                        <div className="size-2 rounded-full bg-saffron-500" />
                      </div>
                    </div>

                    {/* Content Box */}
                    <div
                      className={`ml-12 sm:ml-0 sm:w-1/2 ${
                        isEven
                          ? "sm:pr-14 sm:text-right"
                          : "sm:ml-auto sm:pl-14 sm:text-left"
                      }`}
                    >
                      <div className="inline-block">
                        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-saffron-600">
                          {item.badge}
                        </span>
                        <div className="mt-1 font-display text-[clamp(28px,3.5vw,38px)] leading-none text-clove-800">
                          {item.year}
                        </div>
                        <h3 className="mt-2 font-display text-xl text-clove-700">
                          {item.title}
                        </h3>
                        <p className="mt-2 font-sans text-[15px] leading-relaxed text-clove-600">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 — THE HAKEEM KITCHEN ───────────────────── */}
      <section className="relative border-b border-cream-200 bg-cream-50 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div className="eyebrow mb-3">LIVING HERITAGE</div>
            <h2 className="mb-4 font-display text-[clamp(32px,4vw,48px)] leading-tight text-clove-700">
              The Kitchen Is Where the Legacy Lives.
            </h2>
            <p className="lead mx-auto max-w-2xl text-clove-500">
              At Hakeem, we believe that great food is more than just a meal — it is an experience that brings people together.
            </p>
          </div>

          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
            {/* Story & Culinary Discipline */}
            <div className="lg:col-span-7 space-y-6">
              <p className="font-sans text-[16.5px] leading-relaxed text-clove-600">
                Our menu combines traditional flavours with carefully crafted recipes, using quality ingredients and time-tested cooking techniques.
              </p>
              <p className="font-sans text-[16px] leading-relaxed text-clove-600">
                In a modern culinary landscape where convenience often replaces dedication, our kitchen honors the deliberate rituals that defined royal Mughlai kitchens: sealing deghs with dough for slow dum cooking, dry-roasting whole spices before stone-grinding, and nurturing 48-hour marinades so flavours reach every layer.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="rounded-xl border border-cream-200 bg-cream-100 p-4">
                  <div className="font-display text-2xl text-clove-700">48 Hours</div>
                  <div className="mt-1 font-sans text-xs uppercase tracking-wider text-clove-500">Signature Marinade</div>
                </div>
                <div className="rounded-xl border border-cream-200 bg-cream-100 p-4">
                  <div className="font-display text-2xl text-clove-700">Wood &amp; Clay</div>
                  <div className="mt-1 font-sans text-xs uppercase tracking-wider text-clove-500">Authentic Tandoor</div>
                </div>
              </div>
            </div>

            {/* Connection with Ustad Hakeem Identity */}
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-cream-200 bg-cream-0 p-6 sm:p-8 shadow-warm-sm">
                <div className="eyebrow mb-4">THE MASTER COOK</div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-clove-700 ring-4 ring-cream-100">
                    <span className="font-display text-2xl italic leading-none text-cream-50">
                      H
                    </span>
                  </div>
                  <div>
                    <h3 className="m-0 font-display text-2xl text-clove-700">
                      Ustad Hakeem
                    </h3>
                    <p className="font-sans text-xs uppercase tracking-[0.12em] text-saffron-600">
                      Founder &amp; Master Cook
                    </p>
                  </div>
                </div>
                <p className="font-sans text-[14.5px] leading-relaxed text-clove-600">
                  Ustad Hakeem began cooking in his family kitchen in 1971. After three decades across Lucknow, Delhi, and Hyderabad’s most exacting kitchens, his recipes and techniques remain the bedrock of everything served at Hakeem today.
                </p>
                <div className="mt-5 border-t border-cream-200 pt-4 flex items-center justify-between text-xs text-clove-400">
                  <span>30+ Years Kitchen Wisdom</span>
                  <span className="font-serif italic text-saffron-600">Est. 1971</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5 — OUR PHILOSOPHY ───────────────────────── */}
      <section className="relative border-b border-cream-200 bg-cream-100 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="eyebrow mb-3">OUR CORE VALUES</div>
            <h2 className="font-display text-[clamp(32px,4vw,48px)] leading-tight text-clove-700">
              What We Believe
            </h2>
            <p className="lead mx-auto mt-3 max-w-xl text-clove-500">
              Four timeless principles that guide every recipe, every service, and every interaction.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PHILOSOPHY.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex flex-col border-t border-cream-300 pt-6 transition-all duration-200 hover:-translate-y-1"
                >
                  <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600">
                    <Icon className="size-5" />
                  </div>
                  <div className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-saffron-600">
                    {item.title}
                  </div>
                  <h3 className="mt-1 font-display text-xl text-clove-700">
                    {item.tagline}
                  </h3>
                  <p className="mt-3 font-sans text-[14.5px] leading-relaxed text-clove-600">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 6 — OUR PROMISE ──────────────────────────── */}
      <section className="relative border-b border-cream-200 bg-cream-50 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14">
            <div className="eyebrow mb-3">COMMITMENT</div>
            <h2 className="mb-2 font-display text-[clamp(32px,4vw,48px)] leading-tight text-clove-700">
              Our Promise
            </h2>
            <p className="lead text-clove-500">
              We are committed to:
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PROMISES.map((promise) => (
              <div
                key={promise.num}
                className="group relative rounded-2xl border border-cream-200 bg-cream-0 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-saffron-300 hover:shadow-warm-sm"
              >
                <div className="font-mono text-xs font-semibold text-saffron-500">
                  {promise.num}
                </div>
                <h3 className="mt-3 font-display text-xl text-clove-700 transition-colors group-hover:text-clove-900">
                  {promise.title}
                </h3>
                <p className="mt-2 font-sans text-[14px] leading-relaxed text-clove-500">
                  {promise.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7 — THE LEGACY STATEMENT ─────────────────── */}
      <section className="relative overflow-hidden bg-clove-900 px-6 py-28 sm:py-36 text-center text-cream-50">
        {/* Dot pattern matching restaurant hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/brand/dot-pattern.svg')] opacity-[0.14]"
        />
        {/* Warm saffron ambient light */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-[750px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-saffron-400/10 blur-3xl"
        />

        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="eyebrow mb-6 text-saffron-400">
            SINCE 1971
          </div>

          <div className="mb-4 font-display text-[clamp(56px,8vw,96px)] italic leading-none text-cream-50">
            Hakeem
          </div>

          <h2 className="mb-6 font-display text-[clamp(28px,4.5vw,48px)] leading-tight text-saffron-300">
            Three Generations.<br />
            One Passion for Great Food.
          </h2>

          <p className="mx-auto max-w-xl font-sans text-base leading-relaxed text-clove-300 sm:text-lg">
            A legacy built on family, flavour and the trust of generations of guests.
          </p>

          <div className="mt-10 flex items-center justify-center gap-3 font-sans text-xs uppercase tracking-widest text-clove-400">
            <span>Authentic Recipes</span>
            <span className="text-saffron-400">·</span>
            <span>Family Tradition</span>
            <span className="text-saffron-400">·</span>
            <span>Bhopal, India</span>
          </div>
        </div>
      </section>

      {/* ── SECTION 8 — FINAL CTA ────────────────────────────── */}
      <section className="relative bg-gradient-to-b from-cream-50 to-cream-100 px-6 py-24 sm:py-28 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="eyebrow mb-4">EXPERIENCE HAKEEM</div>

          <h2 className="mb-5 font-display text-[clamp(32px,4.5vw,46px)] leading-tight text-clove-700">
            Come Experience the Hakeem Legacy
          </h2>

          <p className="mx-auto mb-9 font-sans text-base leading-relaxed text-clove-600 sm:text-lg">
            Discover the flavours, hospitality and traditions that have carried Hakeem across generations.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              variant="saffron"
              size="xl"
              render={<Link href="/restaurant">Explore Hakeem</Link>}
              nativeButton={false}
            />
            <Button
              variant="outline"
              size="xl"
              render={<Link href="/courses">Browse Academy Courses</Link>}
              nativeButton={false}
            />
          </div>
        </div>
      </section>
    </>
  );
}
