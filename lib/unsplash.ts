// Unsplash API client — searches landscape photos for recipe titles.
// Uses Demo tier (50 req/hr) by default; Production tier supports 5000/hr.
// Get a free access key at https://unsplash.com/developers

const UNSPLASH_API = "https://api.unsplash.com/search/photos";

type UnsplashPhoto = {
  id: string;
  description: string | null;
  alt_description: string | null;
  urls: { raw: string; regular: string; small: string };
  user: { name: string; username: string; links: { html: string } };
  links: { html: string };
};

type UnsplashSearchResponse = {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
};

export type RecipeImage = {
  url: string;
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
  unsplashId: string;
};

/**
 * Search Unsplash for a recipe image. Returns the best landscape match,
 * or null if no result / API error.
 *
 * The query suffix "indian food" biases results toward authentic dishes
 * rather than generic food photography.
 */
export async function searchRecipeImage(
  recipeTitle: string,
  options: { width?: number; height?: number; quality?: number } = {}
): Promise<RecipeImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.error("UNSPLASH_ACCESS_KEY not set in environment");
    return null;
  }

  // Strip parenthetical aliases — "Butter Chicken (Murgh Makhani)" → "Butter Chicken"
  // helps Unsplash match more reliably.
  const cleanTitle = recipeTitle.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const query = `${cleanTitle} indian food`;

  const searchUrl = new URL(UNSPLASH_API);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("orientation", "landscape");
  searchUrl.searchParams.set("per_page", "3");
  searchUrl.searchParams.set("content_filter", "high");

  try {
    const res = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    });

    if (!res.ok) {
      console.error(`Unsplash API ${res.status} for "${recipeTitle}"`);
      return null;
    }

    const data = (await res.json()) as UnsplashSearchResponse;
    const photo = data.results?.[0];
    if (!photo) {
      console.warn(`No Unsplash result for "${recipeTitle}"`);
      return null;
    }

    const w = options.width ?? 1000;
    const h = options.height ?? 480;
    const q = options.quality ?? 85;
    const url = `${photo.urls.raw}&w=${w}&h=${h}&fit=crop&q=${q}`;

    return {
      url,
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
      unsplashUrl: photo.links.html,
      unsplashId: photo.id,
    };
  } catch (err) {
    console.error(`Unsplash fetch failed for "${recipeTitle}":`, err);
    return null;
  }
}
