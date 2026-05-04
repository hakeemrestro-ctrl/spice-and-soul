import { createClient } from "@supabase/supabase-js";
import { northIndianRecipes } from "./recipes/north-indian-classics";
import { southIndianRecipes } from "./recipes/south-indian-mastery";
import { streetFoodRecipes } from "./recipes/street-food-chaat";
import { biryaniRecipes } from "./recipes/biryani-rice-dishes";
import { sweetsRecipes } from "./recipes/indian-sweets-desserts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const COURSES = [
  {
    slug: "north-indian-classics",
    title: "North Indian Classics — The Royal Kitchen",
    tagline: "From dal to korma — master the heart of Indian cooking",
    description:
      "Learn the foundation of North Indian cuisine — rich gravies, tandoor-style dishes, aromatic dals, and fluffy breads. This course takes you through the Punjabi kitchen step by step.",
    price_cents: 25000,
    difficulty: "Beginner → Intermediate",
    recipe_count: 25,
    published: true,
    is_bundle: false,
    recipes: northIndianRecipes,
  },
  {
    slug: "south-indian-mastery",
    title: "South Indian Mastery — Spices of the South",
    tagline: "Coconut, curry leaves, and coastal flavors",
    description:
      "Explore the vibrant world of South Indian cooking — from crispy dosas and fluffy idlis to rich coconut curries and tangy rasam.",
    price_cents: 59900,
    difficulty: "Beginner → Intermediate",
    recipe_count: 25,
    published: true,
    is_bundle: false,
    recipes: southIndianRecipes,
  },
  {
    slug: "street-food-chaat",
    title: "Street Food & Chaat — India on a Plate",
    tagline: "The chaos and joy of Indian street food, made at home",
    description:
      "Recreate India's most beloved street foods at home — the tangy, spicy, crunchy chaat dishes that define Indian food culture.",
    price_cents: 39900,
    difficulty: "Beginner",
    recipe_count: 22,
    published: true,
    is_bundle: false,
    recipes: streetFoodRecipes,
  },
  {
    slug: "biryani-rice-dishes",
    title: "Biryani & Rice Dishes — The Feast Collection",
    tagline: "Every grain counts — the art of Indian rice cooking",
    description:
      "The most requested Indian dish — biryani — is demystified in this course. Learn 6 regional styles of biryani plus pilaf, khichdi, and other aromatic rice dishes.",
    price_cents: 129900,
    difficulty: "Intermediate → Advanced",
    recipe_count: 20,
    published: true,
    is_bundle: false,
    recipes: biryaniRecipes,
  },
  {
    slug: "indian-sweets-desserts",
    title: "Indian Sweets & Desserts — Mithai Magic",
    tagline: "The sweetest chapter of Indian cuisine",
    description:
      "Indian mithai (sweets) are a world unto themselves. This course teaches the art of making traditional Indian desserts.",
    price_cents: 99900,
    difficulty: "Beginner → Intermediate",
    recipe_count: 22,
    published: true,
    is_bundle: false,
    recipes: sweetsRecipes,
  },
];

async function seed() {
  console.log("Seeding courses and recipes...");

  const insertedCourseIds: string[] = [];

  for (const course of COURSES) {
    const { recipes, ...courseData } = course;

    const { data: courseRow, error: courseErr } = await supabase
      .from("courses")
      .upsert({ ...courseData }, { onConflict: "slug" })
      .select("id")
      .single();

    if (courseErr) {
      console.error(`Failed to upsert course ${course.slug}:`, courseErr);
      process.exit(1);
    }

    insertedCourseIds.push(courseRow.id);
    console.log(`  Course: ${course.title} → ${courseRow.id}`);

    const recipeRows = recipes.map((r, i) => ({
      course_id: courseRow.id,
      title: r.title,
      category: r.category,
      difficulty: r.difficulty,
      prep_time_minutes: (r as { prep_time_minutes?: number }).prep_time_minutes ?? null,
      cook_time_minutes: (r as { cook_time_minutes?: number }).cook_time_minutes ?? null,
      servings: (r as { servings?: number }).servings ?? null,
      ingredients: (r as { ingredients?: unknown }).ingredients ?? null,
      steps: (r as { steps?: unknown }).steps ?? null,
      tips: (r as { tips?: unknown }).tips ?? null,
      image_url: (r as { image_url?: string }).image_url ?? null,
      sort_order: i + 1,
    }));

    const { error: recipesErr } = await supabase
      .from("recipes")
      .upsert(recipeRows, { onConflict: "course_id,sort_order" });

    if (recipesErr) {
      console.error(`Failed to upsert recipes for ${course.slug}:`, recipesErr);
      process.exit(1);
    }

    console.log(`    ${recipes.length} recipes seeded`);
  }

  // Seed bundle
  const { error: bundleErr } = await supabase.from("courses").upsert(
    {
      slug: "bundle-all-5",
      title: "5-Course Bundle — Complete Indian Cooking Mastery",
      tagline: "All 5 courses. 114 recipes. Save $1,550.",
      description:
        "Get all 5 Indian cooking courses at one unbeatable price. From North Indian classics to South Indian mastery, street food, biryani, and Indian sweets — everything in one bundle.",
      price_cents: 199900,
      difficulty: "Beginner → Advanced",
      recipe_count: 114,
      published: true,
      is_bundle: true,
      bundle_course_ids: insertedCourseIds,
    },
    { onConflict: "slug" }
  );

  if (bundleErr) {
    console.error("Failed to upsert bundle:", bundleErr);
    process.exit(1);
  }

  console.log("  Bundle seeded");
  console.log("Seed complete.");
}

seed().catch(console.error);
