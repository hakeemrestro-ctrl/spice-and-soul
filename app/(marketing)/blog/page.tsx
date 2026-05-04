import Link from "next/link";
import { ALL_POSTS } from "@/content/blog";

export const metadata = {
  title: "Blog — Spice & Soul Academy",
  description: "Indian cooking tips, techniques, and stories from Hakeem's kitchen.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndexPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <div className="eyebrow mb-4">FROM HAKEEM&apos;S KITCHEN</div>
      <h1 className="mb-3 font-display text-[clamp(32px,5vw,48px)] leading-tight text-clove-700">
        Cooking tips &amp; stories
      </h1>
      <p className="mb-12 font-sans text-lg leading-relaxed text-clove-500">
        Techniques, ingredient guides, and behind-the-dish stories — free, no signup needed.
      </p>

      <div className="flex flex-col gap-8">
        {ALL_POSTS.map((post) => (
          <article key={post.slug} className="group border-b border-cream-200 pb-8 last:border-0">
            <Link href={`/blog/${post.slug}`} className="no-underline">
              <p className="mb-1 font-sans text-xs text-clove-400">{formatDate(post.publishedAt)} · {post.author}</p>
              <h2 className="mb-2 font-display text-2xl leading-snug text-clove-700 group-hover:text-paprika-600 transition-colors">
                {post.title}
              </h2>
              <p className="font-sans text-[15px] leading-relaxed text-clove-500">
                {post.description}
              </p>
              <span className="mt-3 inline-block font-sans text-sm font-semibold text-saffron-600 group-hover:text-saffron-700">
                Read →
              </span>
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
