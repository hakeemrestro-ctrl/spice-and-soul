import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  Circle,
} from "@react-pdf/renderer";
import type { Course, Recipe, Ingredient } from "@/types";
import { registerPdfFonts } from "@/lib/pdf-fonts";
import { pdfImageUrl } from "@/lib/pdf-image-url";
import { splitRecipeTitle } from "@/lib/recipe-title";

registerPdfFonts();

// ── Brand palette (audit-confirmed hex values from globals.css) ────────
const C = {
  clove900:    "#14100a",
  clove700:    "#281a0d",
  clove600:    "#3e2c19",
  clove500:    "#6b4f35",
  clove400:    "#8c6d50",
  clove300:    "#b89b82",
  saffron700:  "#864806",
  saffron600:  "#a96208",
  saffron500:  "#cb7a13",
  saffron400:  "#f29b1f",
  saffron300:  "#f5b84c",
  saffron100:  "#fde9b5",
  paprika700:  "#7d2a11",
  paprika600:  "#a13818",
  paprika400:  "#d45a28",
  cardamom600: "#4a5c36",
  cream200:    "#efe4ce",
  cream100:    "#f8f1e3",
  cream50:     "#fdfaf3",
  white:       "#ffffff",
};

// ── Type aliases ───────────────────────────────────────────────────────
const FONTS = {
  display: "DM Serif Display",
  sans: "Inter",
} as const;

// ── Stylesheet ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // PAGES ─────────────────────────────────────────────────────────────
  cover: {
    backgroundColor: C.clove900,
    padding: 0,
    fontFamily: FONTS.sans,
  },
  body: {
    backgroundColor: C.cream50,
    paddingHorizontal: 48,
    paddingTop: 64,
    paddingBottom: 48,
    fontFamily: FONTS.sans,
  },

  // FIXED HEADERS / FOOTERS ───────────────────────────────────────────
  bodyHeader: {
    position: "absolute",
    top: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.cream200,
  },
  bodyHeaderLeft: {
    fontSize: 8.5,
    fontFamily: FONTS.sans,
    fontWeight: 500,
    color: C.clove400,
    letterSpacing: 0.4,
  },
  bodyHeaderRight: {
    fontSize: 8.5,
    fontFamily: FONTS.display,
    fontStyle: "italic",
    color: C.clove500,
  },
  pageFooter: {
    position: "absolute",
    bottom: 22,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageFooterText: {
    fontSize: 8,
    fontFamily: FONTS.sans,
    fontWeight: 500,
    color: C.clove400,
  },
  pageFooterRule: {
    flex: 1,
    height: 0.5,
    backgroundColor: C.cream200,
    marginHorizontal: 14,
  },

  // COVER ─────────────────────────────────────────────────────────────
  coverInner: {
    flex: 1,
    paddingHorizontal: 56,
    paddingVertical: 60,
    position: "relative",
  },
  coverEyebrow: {
    fontSize: 9,
    fontFamily: FONTS.sans,
    fontWeight: 600,
    color: C.saffron400,
    letterSpacing: 3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  coverMonogram: {
    position: "absolute",
    top: 200,
    left: 0,
    right: 0,
    fontSize: 280,
    fontFamily: FONTS.display,
    color: C.clove700,
    opacity: 0.4,
    textAlign: "center",
    lineHeight: 1,
  },
  coverTitleStack: {
    marginTop: 180,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  coverMiniLabel: {
    fontSize: 11,
    fontFamily: FONTS.sans,
    fontWeight: 500,
    color: C.saffron300,
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: 14,
  },
  coverTitle: {
    fontSize: 48,
    fontFamily: FONTS.display,
    color: C.cream50,
    lineHeight: 1.05,
    textAlign: "center",
  },
  coverTagline: {
    marginTop: 14,
    fontSize: 18,
    fontFamily: FONTS.display,
    fontStyle: "italic",
    color: C.saffron300,
    textAlign: "center",
  },
  coverHairline: {
    width: 80,
    height: 1,
    backgroundColor: C.saffron400,
    marginTop: 28,
    marginBottom: 28,
    alignSelf: "center",
  },
  coverPersonalisation: {
    alignItems: "center",
    marginTop: 8,
  },
  coverPersonalisedFor: {
    fontSize: 13,
    fontFamily: FONTS.display,
    fontStyle: "italic",
    color: C.clove300,
    textAlign: "center",
  },
  coverRecipeCount: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: FONTS.sans,
    fontWeight: 400,
    color: C.clove400,
    textAlign: "center",
  },
  coverFooterBand: {
    position: "absolute",
    bottom: 40,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  coverFooterText: {
    fontSize: 8,
    fontFamily: FONTS.sans,
    fontWeight: 500,
    color: C.clove500,
  },

  // WELCOME PAGE ───────────────────────────────────────────────────────
  welcomeEyebrow: {
    fontSize: 9.5,
    fontFamily: FONTS.sans,
    fontWeight: 600,
    color: C.saffron500,
    letterSpacing: 3,
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: 80,
    marginBottom: 18,
  },
  welcomeHeadline: {
    fontSize: 36,
    fontFamily: FONTS.display,
    color: C.clove700,
    lineHeight: 1.1,
    textAlign: "center",
    maxWidth: 380,
    marginHorizontal: "auto",
  },
  welcomeTagline: {
    marginTop: 4,
    fontSize: 19,
    fontFamily: FONTS.display,
    fontStyle: "italic",
    color: C.paprika600,
    textAlign: "center",
  },
  welcomeIntro: {
    marginTop: 36,
    paddingHorizontal: 60,
    fontSize: 11.5,
    fontFamily: FONTS.sans,
    color: C.clove600,
    lineHeight: 1.7,
    textAlign: "left",
  },
  welcomeDropCap: {
    fontSize: 56,
    fontFamily: FONTS.display,
    color: C.saffron500,
    lineHeight: 0.85,
  },
  // Inline drop cap — embedded inside paragraph Text. Larger fontSize on
  // an inline span auto-grows the line it sits on, no flex hacks needed.
  welcomeDropCapInline: {
    fontSize: 32,
    fontFamily: FONTS.display,
    color: C.saffron500,
    lineHeight: 1,
  },
  welcomeIntroPara: {
    marginBottom: 12,
    fontSize: 11.5,
    fontFamily: FONTS.sans,
    color: C.clove600,
    lineHeight: 1.7,
  },
  welcomeSignBlock: {
    marginTop: 32,
    paddingHorizontal: 60,
  },
  welcomeSignName: {
    fontSize: 13,
    fontFamily: FONTS.display,
    fontStyle: "italic",
    color: C.saffron600,
  },
  welcomeSignTitle: {
    marginTop: 2,
    fontSize: 9,
    fontFamily: FONTS.sans,
    color: C.clove400,
  },

  // TOC ────────────────────────────────────────────────────────────────
  tocHeading: {
    fontSize: 38,
    fontFamily: FONTS.display,
    color: C.clove700,
    marginTop: 76,
  },
  tocSubheading: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: FONTS.display,
    fontStyle: "italic",
    color: C.saffron500,
    marginBottom: 28,
  },
  // Two stacked Text blocks per row — flex-row had `flex: 1` on title that
  // collapsed when titles wrapped, colliding with category/page metadata.
  tocRow: {
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: C.cream200,
  },
  tocTitleLine: {
    fontSize: 13.5,
    fontFamily: FONTS.display,
    color: C.clove700,
    lineHeight: 1.3,
  },
  tocIndex: {
    fontSize: 10,
    fontFamily: FONTS.sans,
    fontWeight: 600,
    color: C.saffron500,
    letterSpacing: 1,
  },
  tocTitle: {
    fontFamily: FONTS.display,
    color: C.clove700,
  },
  tocSecondary: {
    marginTop: 3,
    fontSize: 8.5,
    fontFamily: FONTS.sans,
    fontWeight: 500,
    color: C.clove400,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },

  // RECIPE PAGE ─────────────────────────────────────────────────────────
  recipeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  recipeEyebrow: {
    fontSize: 9,
    fontFamily: FONTS.sans,
    fontWeight: 600,
    color: C.saffron500,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  categoryChip: {
    backgroundColor: C.saffron100,
    borderRadius: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  categoryChipText: {
    fontSize: 8,
    fontFamily: FONTS.sans,
    fontWeight: 600,
    color: C.saffron700,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  recipeTitle: {
    fontSize: 32,
    fontFamily: FONTS.display,
    color: C.clove700,
    lineHeight: 1.05,
  },
  recipeNative: {
    marginTop: 4,
    fontSize: 18,
    fontFamily: FONTS.display,
    fontStyle: "italic",
    color: C.paprika600,
  },
  recipeTitleRule: {
    width: 64,
    height: 1.5,
    backgroundColor: C.saffron400,
    marginTop: 14,
    marginBottom: 18,
  },
  recipeMeta: {
    fontSize: 10.5,
    fontFamily: FONTS.sans,
    fontWeight: 500,
    color: C.clove500,
    marginBottom: 18,
  },
  heroImage: {
    width: "100%",
    height: 240,
    borderRadius: 4,
    marginTop: 6,
    marginBottom: 22,
  },
  heroFallback: {
    width: "100%",
    height: 240,
    backgroundColor: C.clove700,
    borderRadius: 4,
    marginTop: 6,
    marginBottom: 22,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  heroFallbackH: {
    fontSize: 120,
    fontFamily: FONTS.display,
    color: C.saffron400,
    opacity: 0.3,
    lineHeight: 1,
  },
  heroFallbackCaption: {
    position: "absolute",
    bottom: 18,
    fontSize: 8,
    fontFamily: FONTS.sans,
    fontWeight: 500,
    color: C.cream100,
    opacity: 0.55,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  divider: {
    width: "100%",
    height: 0.5,
    backgroundColor: C.cream200,
    marginBottom: 18,
  },

  // TWO COLUMN BODY ─────────────────────────────────────────────────────
  twoCol: {
    flexDirection: "row",
    gap: 24,
  },
  colIngredients: {
    width: "36%",
  },
  colMethod: {
    flex: 1,
  },
  sectionHeading: {
    fontSize: 10,
    fontFamily: FONTS.sans,
    fontWeight: 600,
    color: C.clove700,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sectionRule: {
    width: 24,
    height: 1,
    backgroundColor: C.saffron400,
    marginBottom: 14,
  },

  // INGREDIENTS ─────────────────────────────────────────────────────────
  // Single inline-Text block — flex-row variants caused row height to stay
  // single-line when name/note wrapped, bleeding into the next ingredient.
  ingredientLine: {
    marginBottom: 8,
    fontSize: 10.5,
    fontFamily: FONTS.sans,
    fontWeight: 400,
    color: C.clove600,
    lineHeight: 1.45,
  },
  ingredientBullet: {
    color: C.saffron400,
    fontFamily: FONTS.sans,
    fontWeight: 700,
  },
  ingredientQty: {
    fontFamily: FONTS.sans,
    fontWeight: 600,
    color: C.clove700,
  },
  ingredientName: {
    fontFamily: FONTS.sans,
    fontWeight: 400,
    color: C.clove600,
  },
  ingredientNote: {
    fontFamily: FONTS.sans,
    fontStyle: "italic",
    color: C.clove400,
  },

  // METHOD ──────────────────────────────────────────────────────────────
  stepText: {
    marginBottom: 14,
    fontSize: 11,
    fontFamily: FONTS.sans,
    fontWeight: 400,
    color: C.clove600,
    lineHeight: 1.65,
  },
  stepNumberInline: {
    fontFamily: FONTS.sans,
    fontWeight: 700,
    color: C.saffron500,
    letterSpacing: 1,
  },
  stepFirstWord: {
    fontFamily: FONTS.sans,
    fontWeight: 600,
    color: C.clove700,
  },

  // TIPS BOX ────────────────────────────────────────────────────────────
  tipsBox: {
    marginTop: 22,
    backgroundColor: C.cream100,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: C.saffron400,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tipsHeading: {
    fontSize: 13,
    fontFamily: FONTS.display,
    fontStyle: "italic",
    color: C.saffron700,
    marginBottom: 8,
  },
  // Single inline-Text — flex-row caused tip text to truncate visually
  // when wrapping past row's single-line height.
  tipLine: {
    marginBottom: 6,
    fontSize: 10,
    fontFamily: FONTS.sans,
    color: C.clove700,
    lineHeight: 1.55,
  },
  tipArrow: {
    fontFamily: FONTS.sans,
    fontWeight: 700,
    color: C.saffron400,
  },

  // BACK COVER ──────────────────────────────────────────────────────────
  backInner: {
    flex: 1,
    paddingHorizontal: 56,
    paddingVertical: 60,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  backH: {
    fontSize: 90,
    fontFamily: FONTS.display,
    color: C.saffron300,
    opacity: 0.4,
    lineHeight: 1,
    marginBottom: 18,
  },
  backHakeem: {
    fontSize: 36,
    fontFamily: FONTS.display,
    fontStyle: "italic",
    color: C.cream50,
    textAlign: "center",
  },
  backAcademy: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: FONTS.sans,
    fontWeight: 500,
    color: C.saffron300,
    letterSpacing: 3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  backRule: {
    width: 40,
    height: 1,
    backgroundColor: C.saffron400,
    marginVertical: 24,
  },
  backAddress: {
    fontSize: 10,
    fontFamily: FONTS.sans,
    color: C.cream100,
    lineHeight: 1.7,
    textAlign: "center",
  },
  backLegal: {
    marginTop: 36,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: C.clove700,
    width: 220,
    alignItems: "center",
  },
  backGst: {
    fontSize: 8,
    fontFamily: FONTS.sans,
    fontWeight: 500,
    color: C.clove300,
    letterSpacing: 1.5,
    textAlign: "center",
  },
  backCopy: {
    marginTop: 4,
    fontSize: 8,
    fontFamily: FONTS.sans,
    color: C.clove400,
    textAlign: "center",
  },
});

// ── Helpers ────────────────────────────────────────────────────────────
function formatTime(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function difficultyColor(d: string): string {
  if (d === "Beginner") return C.cardamom600;
  if (d === "Advanced") return C.paprika600;
  return C.clove500;
}

function buildMetaLine(recipe: Recipe): string {
  const parts: string[] = [];
  if (recipe.servings) parts.push(`${recipe.servings} servings`);
  const prep = recipe.prep_time_minutes;
  const cook = recipe.cook_time_minutes;
  if (prep && cook) {
    parts.push(`${formatTime(prep)} prep + ${formatTime(cook)} cook = ${formatTime(prep + cook)} total`);
  } else if (cook) {
    parts.push(`${formatTime(cook)} cook`);
  } else if (prep) {
    parts.push(`${formatTime(prep)} prep`);
  }
  return parts.join(" · ");
}


// ── Sub-components ─────────────────────────────────────────────────────
function DotOverlay({ color = C.clove300, opacity = 0.18, dotsX = 18, dotsY = 26 }: {
  color?: string;
  opacity?: number;
  dotsX?: number;
  dotsY?: number;
}) {
  // Render an SVG dot grid — vector, scales perfectly, pure react-pdf
  const dots: { cx: number; cy: number }[] = [];
  const stepX = 100 / (dotsX + 1);
  const stepY = 100 / (dotsY + 1);
  for (let x = 1; x <= dotsX; x++) {
    for (let y = 1; y <= dotsY; y++) {
      dots.push({ cx: x * stepX, cy: y * stepY });
    }
  }
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity,
      }}
    >
      <Svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        {dots.map((d, i) => (
          <Circle key={i} cx={d.cx} cy={d.cy} r={0.35} fill={color} />
        ))}
      </Svg>
    </View>
  );
}

function NumberedStep({ index, text }: { index: number; text: string }) {
  const space = text.indexOf(" ");
  const first = space === -1 ? text : text.slice(0, space);
  const rest = space === -1 ? "" : text.slice(space);
  return (
    <Text style={s.stepText}>
      <Text style={s.stepNumberInline}>{String(index + 1).padStart(2, "0")}  </Text>
      <Text style={s.stepFirstWord}>{first}</Text>
      <Text>{rest}</Text>
    </Text>
  );
}

function PageHeader({ courseTitle }: { courseTitle: string }) {
  return (
    <View style={s.bodyHeader} fixed>
      <Text style={s.bodyHeaderLeft}>Hakeem&apos;s · Spice &amp; Soul Academy</Text>
      <Text style={s.bodyHeaderRight}>{courseTitle}</Text>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={s.pageFooter} fixed>
      <Text
        style={s.pageFooterText}
        render={({ pageNumber }) => String(pageNumber).padStart(2, "0")}
      />
      <View style={s.pageFooterRule} />
      <Text style={s.pageFooterText}>Hakeem&apos;s Recipe Collection</Text>
    </View>
  );
}

function IngredientList({ ingredients }: { ingredients: Ingredient[] }) {
  return (
    <View>
      <Text style={s.sectionHeading}>Ingredients</Text>
      <View style={s.sectionRule} />
      {ingredients.map((ing, i) => {
        const qty = (ing.quantity ?? "").trim();
        const unit = (ing.unit ?? "").trim();
        const qtyText = qty ? (unit ? `${qty} ${unit}` : qty) : "";
        return (
          <Text key={i} style={s.ingredientLine}>
            <Text style={s.ingredientBullet}>•  </Text>
            {qtyText ? <Text style={s.ingredientQty}>{`${qtyText}  `}</Text> : null}
            <Text style={s.ingredientName}>{ing.name}</Text>
            {ing.notes ? <Text style={s.ingredientNote}>{` — ${ing.notes}`}</Text> : null}
          </Text>
        );
      })}
    </View>
  );
}

function MethodStepList({ steps }: { steps: string[] }) {
  return (
    <View>
      <Text style={s.sectionHeading}>Method</Text>
      <View style={s.sectionRule} />
      {steps.map((step, i) => (
        <NumberedStep key={i} index={i} text={step} />
      ))}
    </View>
  );
}

function TipsBox({ tips }: { tips: string[] }) {
  return (
    <View style={s.tipsBox} wrap={false}>
      <Text style={s.tipsHeading}>Chef&apos;s tips</Text>
      {tips.map((tip, i) => (
        <Text key={i} style={s.tipLine}>
          <Text style={s.tipArrow}>›  </Text>
          {tip}
        </Text>
      ))}
    </View>
  );
}

function HeroImage({ url }: { url: string | null }) {
  const transformed = pdfImageUrl(url, 1000, 480);
  if (transformed) {
    return <Image src={transformed} style={s.heroImage} alt="" />;
  }
  return (
    <View style={s.heroFallback}>
      <DotOverlay color={C.saffron400} opacity={0.05} dotsX={20} dotsY={10} />
      <Text style={s.heroFallbackH}>H</Text>
      <Text style={s.heroFallbackCaption}>No image available</Text>
    </View>
  );
}

// ── Main Document ──────────────────────────────────────────────────────
type Props = {
  course: Course;
  recipes: Recipe[];
  customerName: string;
  date: string;
};

export function RecipePdf({ course, recipes, customerName, date }: Props) {
  const firstName = customerName.split(" ")[0] || customerName;

  return (
    <Document
      title={`${course.title} — Hakeem's Recipe Book`}
      author="Hakeem's · Spice & Soul Academy"
      subject="Authentic Indian Cooking Recipes"
    >
      {/* ══════════════════════════════════════════════════════════════ COVER */}
      <Page size="A4" style={s.cover}>
        <View style={s.coverInner}>
          <DotOverlay color={C.saffron400} opacity={0.08} dotsX={18} dotsY={26} />

          <Text style={s.coverEyebrow}>Spice &amp; Soul Academy · by Hakeem&apos;s</Text>

          <View style={s.coverTitleStack}>
            <Text style={s.coverMiniLabel}>RECIPE COLLECTION</Text>
            <Text style={s.coverTitle}>{course.title}</Text>
            {course.tagline ? (
              <Text style={s.coverTagline}>{course.tagline}</Text>
            ) : null}
            <View style={s.coverHairline} />

            <View style={s.coverPersonalisation}>
              <Text style={s.coverPersonalisedFor}>
                Personally curated for {firstName}
              </Text>
              <Text style={s.coverRecipeCount}>
                {recipes.length} hand-tested recipes
              </Text>
            </View>
          </View>

          <View style={s.coverFooterBand}>
            <Text style={s.coverFooterText}>
              GSTIN 23CNEPK6523K1ZZ · NK Ventures
            </Text>
            <Text style={s.coverFooterText}>{date}</Text>
          </View>
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════════════ WELCOME */}
      <Page size="A4" style={s.body}>
        <PageHeader courseTitle={course.title} />

        <Text style={s.welcomeEyebrow}>A note from our kitchen</Text>
        <Text style={s.welcomeHeadline}>Cook patient food.</Text>
        <Text style={s.welcomeTagline}>It is the only kind worth eating.</Text>

        <View style={s.welcomeIntro}>
          <Text style={s.welcomeIntroPara}>
            <Text style={s.welcomeDropCapInline}>T</Text>
            hese recipes come from a kitchen that has been cooking the same way since 1987. Every spice ratio, every cooking time, every tip — carried forward from Ustad Hakeem&apos;s original notes and tested again in our Indore kitchen before being written here for you.
          </Text>

          <Text style={s.welcomeIntroPara}>
            Read each recipe fully before you begin. Taste as you cook. Adjust the chilli to your family&apos;s heat. And remember — great Indian food is patient food. Don&apos;t rush the oil or the onions.
          </Text>

          <Text style={s.welcomeIntroPara}>
            Welcome to {course.title}. We hope it earns a place in your kitchen for years to come.
          </Text>
        </View>

        <View style={s.welcomeSignBlock}>
          <Text style={s.welcomeSignName}>— Naveed Khan</Text>
          <Text style={s.welcomeSignTitle}>NK Ventures · Indore</Text>
        </View>

        <PageFooter />
      </Page>

      {/* ══════════════════════════════════════════════════════════════ TOC */}
      <Page size="A4" style={s.body}>
        <PageHeader courseTitle={course.title} />

        <Text style={s.tocHeading}>Contents</Text>
        <Text style={s.tocSubheading}>{recipes.length} recipes</Text>

        <View>
          {recipes.map((recipe, i) => {
            const { primary } = splitRecipeTitle(recipe.title);
            // page 1 = welcome, 2 = TOC, recipes start at 3
            const pageNum = String(i + 3).padStart(2, "0");
            return (
              <View key={recipe.id} style={s.tocRow} wrap={false}>
                <Text style={s.tocTitleLine}>
                  <Text style={s.tocIndex}>{`${String(i + 1).padStart(2, "0")}   `}</Text>
                  <Text style={s.tocTitle}>{primary}</Text>
                </Text>
                <Text style={s.tocSecondary}>
                  {`${recipe.category.toUpperCase()}  ·  PAGE ${pageNum}`}
                </Text>
              </View>
            );
          })}
        </View>

        <PageFooter />
      </Page>

      {/* ══════════════════════════════════════════════════════════════ RECIPE PAGES */}
      {recipes.map((recipe, i) => {
        const { primary, secondary } = splitRecipeTitle(recipe.title);
        const ingredients = recipe.ingredients ?? [];
        const steps = recipe.steps ?? [];
        const tips = recipe.tips ?? [];
        const ingredientsWrapWhole = ingredients.length <= 14;

        return (
          <Page key={recipe.id} size="A4" style={s.body}>
            <PageHeader courseTitle={course.title} />

            {/* HEADER + IMAGE — keep together */}
            <View wrap={false}>
              <View style={s.recipeHeaderRow}>
                <Text style={s.recipeEyebrow}>
                  Recipe {String(i + 1).padStart(2, "0")} of {recipes.length} · {recipe.category}
                </Text>
                <View style={s.categoryChip}>
                  <Text style={s.categoryChipText}>{recipe.difficulty}</Text>
                </View>
              </View>

              <Text style={s.recipeTitle}>{primary}</Text>
              {secondary ? <Text style={s.recipeNative}>{secondary}</Text> : null}
              <View style={s.recipeTitleRule} />

              <Text style={s.recipeMeta}>
                <Text style={{ color: difficultyColor(recipe.difficulty), fontWeight: 600 }}>
                  {recipe.difficulty}
                </Text>
                {buildMetaLine(recipe) ? ` · ${buildMetaLine(recipe)}` : ""}
              </Text>

              <HeroImage url={recipe.image_url} />
              <View style={s.divider} />
            </View>

            {/* BODY — flowing two-column */}
            <View style={s.twoCol}>
              <View style={s.colIngredients}>
                {ingredientsWrapWhole ? (
                  <View wrap={false}>
                    {ingredients.length > 0 ? (
                      <IngredientList ingredients={ingredients} />
                    ) : (
                      <Text style={[s.ingredientName, { fontStyle: "italic", color: C.clove400 }]}>
                        Full ingredient list available in the email PDF.
                      </Text>
                    )}
                  </View>
                ) : (
                  ingredients.length > 0 ? (
                    <IngredientList ingredients={ingredients} />
                  ) : (
                    <Text style={[s.ingredientName, { fontStyle: "italic", color: C.clove400 }]}>
                      Full ingredient list available in the email PDF.
                    </Text>
                  )
                )}
              </View>
              <View style={s.colMethod}>
                {steps.length > 0 ? (
                  <MethodStepList steps={steps} />
                ) : (
                  <Text style={[s.stepText, { fontStyle: "italic", color: C.clove400 }]}>
                    Full method available in the email PDF.
                  </Text>
                )}
              </View>
            </View>

            {tips.length > 0 ? <TipsBox tips={tips} /> : null}

            <PageFooter />
          </Page>
        );
      })}

      {/* ══════════════════════════════════════════════════════════════ BACK COVER */}
      <Page size="A4" style={s.cover}>
        <View style={s.backInner}>
          <DotOverlay color={C.saffron400} opacity={0.08} dotsX={18} dotsY={26} />

          <Text style={s.backH}>H</Text>
          <Text style={s.backHakeem}>Hakeem&apos;s</Text>
          <Text style={s.backAcademy}>Spice &amp; Soul Academy</Text>

          <View style={s.backRule} />

          <Text style={s.backAddress}>
            34, Siyaganj Market Road{"\n"}
            Indore, Madhya Pradesh — 452 001{"\n"}
            +91 731 245 6789{"\n"}
            spiceandsoul.com
          </Text>

          <View style={s.backLegal}>
            <Text style={s.backGst}>GSTIN 23CNEPK6523K1ZZ</Text>
            <Text style={s.backCopy}>© 2026 NK Ventures · Owner: Naveed Khan</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
