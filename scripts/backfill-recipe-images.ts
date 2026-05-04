/**
 * Backfill recipe images from Unsplash.
 *
 * Iterates every recipe in the database, queries Unsplash for the title,
 * and updates `image_url` with the best landscape match. Pauses 800ms
 * between calls to stay well under the Demo tier rate limit (50/hr).
 *
 * Usage:
 *   npm run images:backfill                    # all recipes (skips existing)
 *   npm run images:backfill -- --force         # overwrites existing URLs
 *   npm run images:backfill -- --slug=biryani-rice-dishes   # one course
 *
 * Requires UNSPLASH_ACCESS_KEY + Supabase env vars in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { searchRecipeImage } from "../lib/unsplash";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!unsplashKey) {
  console.error("Missing UNSPLASH_ACCESS_KEY in .env.local");
  console.error("Get a free key at https://unsplash.com/developers");
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const slugArg = args.find((a) => a.startsWith("--slug="));
const slug = slugArg ? slugArg.split("=")[1] : null;

const supabase = createClient(supabaseUrl, serviceKey);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Optional course filter
  let courseFilter: string[] | null = null;
  if (slug) {
    const { data: courseRow, error } = await supabase
      .from("courses")
      .select("id")
      .eq("slug", slug)
      .single();
    if (error || !courseRow) {
      console.error(`Course not found: ${slug}`);
      process.exit(1);
    }
    courseFilter = [courseRow.id];
    console.log(`Filtering to course: ${slug} (${courseRow.id})`);
  }

  let query = supabase
    .from("recipes")
    .select("id, title, image_url, course_id")
    .order("sort_order");

  if (courseFilter) {
    query = query.in("course_id", courseFilter);
  }

  if (!force) {
    query = query.is("image_url", null);
  }

  const { data: recipes, error } = await query;
  if (error) {
    console.error("Failed to fetch recipes:", error);
    process.exit(1);
  }

  if (!recipes || recipes.length === 0) {
    console.log("No recipes to backfill (use --force to overwrite existing URLs).");
    return;
  }

  console.log(`Backfilling ${recipes.length} recipe images...\n`);

  let success = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const [i, recipe] of recipes.entries()) {
    const progress = `[${i + 1}/${recipes.length}]`;
    process.stdout.write(`${progress} ${recipe.title.padEnd(50, " ").slice(0, 50)} ... `);

    const result = await searchRecipeImage(recipe.title);

    if (!result) {
      console.log("FAILED");
      failed++;
      failures.push(recipe.title);
      await sleep(800);
      continue;
    }

    const { error: updateErr } = await supabase
      .from("recipes")
      .update({ image_url: result.url })
      .eq("id", recipe.id);

    if (updateErr) {
      console.log(`DB ERROR: ${updateErr.message}`);
      failed++;
      failures.push(recipe.title);
    } else {
      console.log(`OK (by ${result.photographer})`);
      success++;
    }

    // Stay under Demo tier rate limit (50/hr = 1 per ~72s, but Production = 5000/hr)
    // 800ms gives ~75 req/min on Production, gentle on Demo.
    await sleep(800);
  }

  console.log(`\n--- Done ---`);
  console.log(`Success: ${success}`);
  console.log(`Failed:  ${failed}`);
  if (failures.length > 0) {
    console.log(`\nFailed recipes (try --force to retry, or override manually in seed):`);
    failures.forEach((t) => console.log(`  - ${t}`));
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
