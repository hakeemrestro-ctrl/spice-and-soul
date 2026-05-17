import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_POSTS } from "@/content/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("slug, created_at")
    .eq("published", true)
    .order("created_at");

  const courseUrls: MetadataRoute.Sitemap = (courses ?? []).map((c) => ({
    url: `${BASE}/courses/${c.slug}`,
    lastModified: c.created_at,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const blogUrls: MetadataRoute.Sitemap = ALL_POSTS.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: new Date(p.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/courses`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/restaurant`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/resend`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/refund-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
    ...courseUrls,
    ...blogUrls,
  ];
}
