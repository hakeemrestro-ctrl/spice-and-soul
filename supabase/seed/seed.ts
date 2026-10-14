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
      "This course covers the fundamentals of Mughal-influenced North Indian cooking — the same techniques behind every great restaurant curry you have ever tasted. You will master three essential base gravies (onion-tomato, cashew-cream, and brown-onion) that unlock 25 dishes: butter chicken, dal makhani, chole, shahi paneer, palak kofta, rajma, and more. Every spice blend is made from scratch, every measurement is exact, and every step is explained so you understand the why — not just the how. By the end you will have the confidence to cook a full North Indian spread from memory, adjusting heat, richness, and seasoning to your own taste.",
    price_cents: 1249900,  // ₹12,499
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
      "South Indian cuisine is built on different foundations than the north — coconut oil, curry leaves, mustard seeds, tamarind, and fermented batters. This course teaches you the science behind a perfect dosa (the exact urad-to-rice ratio, the right fermentation time, the correct pan temperature) and the art of balancing sour, spicy, and coconut flavours in sambhar, rasam, and five regional chutneys. 25 recipes span all four southern states: Tamil Nadu, Kerala, Andhra Pradesh, and Karnataka — from soft idli and crispy medu vada to Kerala fish curry, Chettinad chicken, and coconut-heavy stews. You will also learn the pantry staples that make South Indian cooking fast and repeatable once the basics are in place.",
    price_cents: 1999900,  // ₹19,999
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
      "India's streets are where the boldest cooking happens — fast, loud, and built for maximum flavour per bite. This course breaks down the genius of chaat: the precise layering of chutneys, the crunch of sev, the tang of tamarind water, and the fire of green chilli paste. You will learn pani puri, bhel puri, sev puri, dahi vada, aloo tikki chaat, samosa chaat, ragda pattice, and 15 more recipes drawn directly from Mumbai's Juhu beach and Delhi's Chandni Chowk. Each recipe includes the chutneys, masalas, and assembly technique so every bite hits the right balance of sweet, sour, spicy, and crunchy.",
    price_cents: 1899900,  // ₹18,999
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
      "Biryani is not one dish — it is a family of regional masterpieces, each with its own spice dialect, rice-to-meat ratio, and cooking method. This course teaches six distinct biryani styles: Hyderabadi dum, Lucknowi awadhi, Kolkata, Malabar, Sindhi, and Bombay — including the exact spice blends, marination times, and dum-sealing techniques that make each one authentic. Beyond biryani, you will learn jeera rice, Kashmiri pulao, dal khichdi, tahari, and the fundamentals of cooking basmati so every grain stays separate and fragrant. 20 recipes in total, with detailed guidance on sourcing the right rice, the right meat cuts, and the right whole spices so the results are consistently restaurant quality.",
    price_cents: 2499900,  // ₹24,999
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
      "Indian mithai is its own discipline — it demands precise heat control, exact sugar ratios, and the patience to bring milk solids to the right consistency without burning. This course teaches 22 traditional sweets from across India: gulab jamun, rasgulla, kaju katli, besan barfi, gajar halwa, moong dal halwa, kheer, rabri, shahi tukda, and more. Ustad Hakeem explains the most common mistakes — grainy barfi, rubbery gulab jamun, kheer that splits — and gives exact fixes so your first batch looks and tastes like it came from the best mithai shop in Bhopal. Every recipe includes storage tips, shelf life, and gifting guidance so you can make sweets for festivals, weddings, and everyday indulgence.",
    price_cents: 2299900,  // ₹22,999
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

    // Query existing recipes for this course to preserve existing IDs and ensure idempotency
    const { data: existingRecipes, error: fetchErr } = await supabase
      .from("recipes")
      .select("id, sort_order")
      .eq("course_id", courseRow.id);

    if (fetchErr) {
      console.error(`Failed to fetch existing recipes for ${course.slug}:`, fetchErr);
      process.exit(1);
    }

    const existingMap = new Map((existingRecipes ?? []).map((ex) => [ex.sort_order, ex.id]));
    const recipeRowsWithIds = recipeRows.map((r) => ({
      ...r,
      ...(existingMap.has(r.sort_order) ? { id: existingMap.get(r.sort_order) } : {}),
    }));

    const { error: recipesErr } = await supabase
      .from("recipes")
      .upsert(recipeRowsWithIds);

    if (recipesErr) {
      console.error(`Failed to upsert recipes for ${course.slug}:`, recipesErr);
      process.exit(1);
    }

    console.log(`    ${recipes.length} recipes seeded`);
  }

  // Seed coming-soon courses (published: false — shown on /courses as "Coming Soon")
  const comingSoonCourses = [
    {
      slug: "tandoor-masterclass",
      title: "Tandoor Masterclass",
      tagline: "Clay oven secrets — naans, kebabs & tikka from scratch",
      description:
        "Unlock the ancient art of tandoor cooking. Learn to make restaurant-style naans, seekh kebabs, chicken tikka, and paneer dishes using authentic techniques adapted for home ovens and stovetops.",
      price_cents: 2499900, // ₹24,999
      difficulty: "Intermediate",
      recipe_count: 22,
      published: false,
      is_bundle: false,
    },
    {
      slug: "coastal-seafood-curries",
      title: "Coastal Seafood Curries",
      tagline: "Goan, Kerala & Konkan recipes from India's spice coasts",
      description:
        "Dive into India's coastal kitchens. Master fish curries, prawn masala, crab preparations, coconut-based gravies, and the bold tamarind-forward flavors of Goa, Kerala, and the Konkan coast.",
      price_cents: 2249900, // ₹22,499
      difficulty: "Intermediate",
      recipe_count: 20,
      published: false,
      is_bundle: false,
    },
  ];

  for (const cs of comingSoonCourses) {
    const { error } = await supabase.from("courses").upsert(cs, { onConflict: "slug" });
    if (error) {
      console.error(`Failed to upsert coming-soon course ${cs.slug}:`, error);
    } else {
      console.log(`  Coming-soon course: ${cs.title}`);
    }
  }

  // Seed bundle
  const { error: bundleErr } = await supabase.from("courses").upsert(
    {
      slug: "bundle-all-5",
      title: "5-Course Bundle — Complete Indian Cooking Mastery",
      tagline: "All 5 courses. 114 recipes. Save ₹1,47,895.",
      description:
        "Get all 5 Indian cooking courses at one unbeatable price. From North Indian classics to South Indian mastery, street food, biryani, and Indian sweets — everything in one bundle.",
      price_cents: 18999900,  // ₹189,999
      difficulty: "Beginner → Advanced",
      recipe_count: 114,
      published: false,  // Hidden until bundle API key received
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
