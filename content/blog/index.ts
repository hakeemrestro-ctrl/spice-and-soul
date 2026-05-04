// Blog post registry — add new posts here after creating their .tsx file.

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  author: string;
  ogImage: string | null;
};

// Statically import metas (Next.js tree-shakes unused exports)
import { meta as masalaMeta } from "./how-to-grind-masala";

export const ALL_POSTS: PostMeta[] = [masalaMeta].sort(
  (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
);

export function getPostMeta(slug: string): PostMeta | undefined {
  return ALL_POSTS.find((p) => p.slug === slug);
}
