import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostMeta, ALL_POSTS } from "@/content/blog";
import { NewsletterSignup } from "@/components/newsletter-signup";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const meta = getPostMeta(slug);
  if (!meta) return {};
  return {
    title: `${meta.title} — Spice & Soul Academy`,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "article",
      publishedTime: meta.publishedAt,
      authors: [meta.author],
    },
  };
}

export function generateStaticParams() {
  return ALL_POSTS.map((p) => ({ slug: p.slug }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const meta = getPostMeta(slug);
  if (!meta) notFound();

  // Dynamically import the post component
  const { default: PostContent } = await import(`@/content/blog/${slug}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.publishedAt,
    author: { "@type": "Person", name: meta.author },
    publisher: {
      "@type": "Organization",
      name: "Spice & Soul Academy",
      url: process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1.5 font-sans text-sm text-clove-400 hover:text-clove-600"
        >
          ← All posts
        </Link>

        <div className="eyebrow mb-4">FROM HAKEEM&apos;S KITCHEN</div>

        <h1 className="mb-4 font-display text-[clamp(28px,4vw,42px)] leading-tight text-clove-700">
          {meta.title}
        </h1>

        <p className="mb-10 font-sans text-sm text-clove-400">
          {formatDate(meta.publishedAt)} · {meta.author}
        </p>

        <div className="prose-spice">
          <PostContent />
        </div>

        <div className="mt-16 border-t border-cream-200 pt-12">
          <NewsletterSignup variant="inline" />
        </div>
      </main>
    </>
  );
}
