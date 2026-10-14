import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { registerPdfFonts } from "@/lib/pdf-fonts";

registerPdfFonts();

// ── Image props type ───────────────────────────────────────────────────
export type CurriculumImages = {
  cover: string;
  butterChicken: string;
  palakPaneer: string;
  chanaMasala: string;
  spices: string;
};

// ── Brand palette ──────────────────────────────────────────────────────
const C = {
  clove900:   "#14100a",
  clove700:   "#281a0d",
  clove600:   "#3e2c19",
  clove500:   "#6b4f35",
  clove400:   "#8c6d50",
  clove300:   "#b89b82",
  clove200:   "#d4bfa8",
  saffron600: "#a96208",
  saffron500: "#cb7a13",
  saffron400: "#f29b1f",
  saffron300: "#f5b84c",
  saffron100: "#fde9b5",
  paprika600: "#a13818",
  paprika400: "#d45a28",
  cardamom600:"#4a5c36",
  cream200:   "#efe4ce",
  cream100:   "#f8f1e3",
  cream50:    "#fdfaf3",
  white:      "#ffffff",
};

const F = { display: "DM Serif Display", sans: "Inter" } as const;


// ── Stylesheet ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Pages
  cover: {
    backgroundColor: C.clove900,
    padding: 0,
    fontFamily: F.sans,
  },
  body: {
    backgroundColor: C.cream50,
    paddingHorizontal: 44,
    paddingTop: 56,
    paddingBottom: 44,
    fontFamily: F.sans,
  },
  sectionDivider: {
    backgroundColor: C.clove700,
    padding: 0,
    fontFamily: F.sans,
  },

  // Header / footer
  pageHeader: {
    position: "absolute",
    top: 18,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: C.cream200,
    paddingBottom: 6,
  },
  headerText: { fontSize: 7.5, color: C.clove400, fontFamily: F.sans, fontWeight: 400 },
  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: C.cream200,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: C.clove400 },

  // Cover page
  coverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(20,16,10,0.72)",
  },
  coverContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 56,
  },
  coverEyebrow: {
    fontSize: 9,
    fontFamily: F.sans,
    fontWeight: 600,
    color: C.saffron400,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  coverTitle: {
    fontSize: 38,
    fontFamily: F.display,
    color: C.white,
    textAlign: "center",
    lineHeight: 1.12,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 17,
    fontFamily: F.display,
    fontStyle: "italic",
    color: C.saffron300,
    textAlign: "center",
    marginBottom: 36,
  },
  coverDivider: {
    width: 48,
    height: 1.5,
    backgroundColor: C.saffron500,
    marginBottom: 28,
  },
  coverMeta: {
    fontSize: 9,
    fontFamily: F.sans,
    color: C.clove300,
    textAlign: "center",
    lineHeight: 1.7,
  },
  coverBadge: {
    marginTop: 40,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.saffron500,
    borderRadius: 2,
  },
  coverBadgeText: {
    fontSize: 8,
    fontFamily: F.sans,
    fontWeight: 600,
    color: C.saffron400,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // Section divider page
  dividerBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  dividerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(20,16,10,0.78)",
  },
  dividerContent: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 52,
  },
  dividerNumber: {
    fontSize: 64,
    fontFamily: F.display,
    color: C.saffron600,
    lineHeight: 1,
    marginBottom: 4,
  },
  dividerLabel: {
    fontSize: 8,
    fontFamily: F.sans,
    fontWeight: 600,
    color: C.saffron400,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  dividerTitle: {
    fontSize: 32,
    fontFamily: F.display,
    color: C.white,
    lineHeight: 1.1,
    marginBottom: 10,
  },
  dividerTagline: {
    fontSize: 13,
    fontFamily: F.display,
    fontStyle: "italic",
    color: C.clove300,
  },

  // Hero image card
  heroImage: {
    width: "100%",
    height: 170,
    objectFit: "cover",
    borderRadius: 4,
    marginBottom: 5,
  },
  heroCaption: {
    fontSize: 7.5,
    color: C.clove400,
    textAlign: "right",
    marginTop: 4,
    marginBottom: 14,
    fontStyle: "italic",
  },

  // Headings
  h1: {
    fontSize: 28,
    fontFamily: F.display,
    color: C.clove700,
    marginBottom: 6,
  },
  h2: {
    fontSize: 16,
    fontFamily: F.display,
    color: C.clove700,
    marginBottom: 8,
    marginTop: 18,
  },
  h3: {
    fontSize: 11,
    fontFamily: F.sans,
    fontWeight: 700,
    color: C.clove700,
    marginBottom: 6,
    marginTop: 14,
  },
  eyebrow: {
    fontSize: 7.5,
    fontFamily: F.sans,
    fontWeight: 600,
    letterSpacing: 2.5,
    color: C.saffron600,
    textTransform: "uppercase",
    marginBottom: 4,
  },

  // Body text
  body1: { fontSize: 9.5, lineHeight: 1.65, color: C.clove600, marginBottom: 8 },
  body2: { fontSize: 8.5, lineHeight: 1.6, color: C.clove500 },
  bold: { fontWeight: 700, color: C.clove700 },
  italic: { fontStyle: "italic" },

  // Bullet / numbered list
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  bullet: { fontSize: 9, color: C.saffron500, marginRight: 6, marginTop: 1.5 },
  listText: { fontSize: 9, lineHeight: 1.55, color: C.clove600, flex: 1 },
  stepNumber: {
    fontSize: 8.5,
    fontWeight: 700,
    color: C.saffron600,
    marginRight: 6,
    minWidth: 16,
  },

  // Table
  table: { marginBottom: 14, borderWidth: 0.5, borderColor: C.cream200 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.cream200 },
  tableRowAlt: { flexDirection: "row", backgroundColor: C.cream100, borderBottomWidth: 0.5, borderBottomColor: C.cream200 },
  tableHeader: { backgroundColor: C.clove700 },
  thCell: { paddingHorizontal: 8, paddingVertical: 5, flex: 1 },
  thText: { fontSize: 7.5, fontWeight: 700, color: C.saffron300, textTransform: "uppercase", letterSpacing: 0.5 },
  tdCell: { paddingHorizontal: 8, paddingVertical: 5, flex: 1 },
  tdText: { fontSize: 8.5, color: C.clove600, lineHeight: 1.4 },
  tdTextBold: { fontSize: 8.5, color: C.clove700, fontWeight: 700, lineHeight: 1.4 },

  // Stat bar (vital stats)
  statBar: {
    flexDirection: "row",
    backgroundColor: C.clove700,
    borderRadius: 4,
    padding: 12,
    marginBottom: 18,
    justifyContent: "space-between",
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 12, fontFamily: F.display, color: C.saffron400, marginBottom: 1 },
  statLabel: { fontSize: 6.5, fontFamily: F.sans, fontWeight: 600, color: C.clove300, textTransform: "uppercase", letterSpacing: 1 },

  // Ingredient category header
  ingCategory: {
    backgroundColor: C.cream200,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
    marginTop: 10,
  },
  ingCategoryText: { fontSize: 7.5, fontWeight: 700, color: C.clove700, textTransform: "uppercase", letterSpacing: 1 },

  // Chef's note box
  chefNote: {
    backgroundColor: C.saffron100,
    borderLeftWidth: 3,
    borderLeftColor: C.saffron500,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 2,
  },
  chefNoteLabel: { fontSize: 7, fontWeight: 700, color: C.saffron600, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3 },
  chefNoteText: { fontSize: 8.5, color: C.clove600, lineHeight: 1.55 },

  // Warning box
  warningBox: {
    backgroundColor: "#fff5f5",
    borderLeftWidth: 3,
    borderLeftColor: C.paprika600,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    borderRadius: 2,
  },
  warningText: { fontSize: 8.5, color: C.paprika600, lineHeight: 1.5, fontWeight: 600 },

  // Phase header
  phaseHeader: {
    backgroundColor: C.clove600,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 2,
  },
  phaseHeaderText: { fontSize: 8.5, fontWeight: 700, color: C.saffron300, textTransform: "uppercase", letterSpacing: 1 },

  // Section divider line
  hr: { height: 0.75, backgroundColor: C.cream200, marginVertical: 14 },

  // Grid columns
  row: { flexDirection: "row", gap: 12 },
  col2: { flex: 1 },

  // Assessment rubric cell widths
  rubricCrit: { flex: 2.5 },
  rubricMarks: { flex: 0.8 },
  rubricDesc: { flex: 4 },

  // Cover footer bar
  coverFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.saffron600,
    paddingHorizontal: 44,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverFooterText: { fontSize: 8, color: C.white, fontFamily: F.sans },
});

// ── Helpers ────────────────────────────────────────────────────────────

function PageHeader({ title, chapter }: { title: string; chapter: string }) {
  return (
    <View style={s.pageHeader} fixed>
      <Text style={s.headerText}>Spice &amp; Soul Academy — Culinary Curriculum</Text>
      <Text style={s.headerText}>{chapter} · {title}</Text>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={s.pageFooter} fixed>
      <Text style={s.footerText}>N K VENTURES · hakeemrestro@gmail.com · +91 9406565799</Text>
      <Text style={s.footerText} render={({ pageNumber }) => `Page ${pageNumber}`} />
    </View>
  );
}

function Eyebrow({ text }: { text: string }) {
  return <Text style={s.eyebrow}>{text}</Text>;
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.listItem}>
      <Text style={s.bullet}>•</Text>
      <Text style={s.listText}>{text}</Text>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={s.listItem}>
      <Text style={s.stepNumber}>{n}.</Text>
      <Text style={s.listText}>{text}</Text>
    </View>
  );
}

function ChefNote({ text }: { text: string }) {
  return (
    <View style={s.chefNote}>
      <Text style={s.chefNoteLabel}>{"Chef's Note"}</Text>
      <Text style={s.chefNoteText}>{text}</Text>
    </View>
  );
}

function PhaseHeader({ text }: { text: string }) {
  return (
    <View style={s.phaseHeader}>
      <Text style={s.phaseHeaderText}>{text}</Text>
    </View>
  );
}

function StatBar({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <View style={s.statBar}>
      {items.map((item) => (
        <View key={item.label} style={s.statItem}>
          <Text style={s.statValue}>{item.value}</Text>
          <Text style={s.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function IngCategory({ text }: { text: string }) {
  return (
    <View style={s.ingCategory}>
      <Text style={s.ingCategoryText}>{text}</Text>
    </View>
  );
}

function IngRow({ name, metric, imperial, alt }: { name: string; metric: string; imperial?: string; alt?: boolean }) {
  const rowStyle = alt ? s.tableRowAlt : s.tableRow;
  return (
    <View style={rowStyle}>
      <View style={[s.tdCell, { flex: 2.5 }]}><Text style={s.tdText}>{name}</Text></View>
      <View style={[s.tdCell, { flex: 1.2 }]}><Text style={s.tdText}>{metric}</Text></View>
      <View style={[s.tdCell, { flex: 1.2 }]}><Text style={s.tdText}>{imperial ?? "—"}</Text></View>
    </View>
  );
}

function IngTable({ rows }: { rows: { name: string; metric: string; imperial?: string }[] }) {
  return (
    <View style={s.table}>
      <View style={[s.tableRow, s.tableHeader]}>
        <View style={[s.thCell, { flex: 2.5 }]}><Text style={s.thText}>Ingredient</Text></View>
        <View style={[s.thCell, { flex: 1.2 }]}><Text style={s.thText}>Metric</Text></View>
        <View style={[s.thCell, { flex: 1.2 }]}><Text style={s.thText}>Imperial</Text></View>
      </View>
      {rows.map((r, i) => <IngRow key={r.name} {...r} alt={i % 2 === 1} />)}
    </View>
  );
}

function TroubleRow({ issue, cause, fix, alt }: { issue: string; cause: string; fix: string; alt?: boolean }) {
  return (
    <View style={alt ? s.tableRowAlt : s.tableRow}>
      <View style={[s.tdCell, { flex: 1.5 }]}><Text style={s.tdTextBold}>{issue}</Text></View>
      <View style={[s.tdCell, { flex: 2 }]}><Text style={s.tdText}>{cause}</Text></View>
      <View style={[s.tdCell, { flex: 2 }]}><Text style={s.tdText}>{fix}</Text></View>
    </View>
  );
}

function HR() {
  return <View style={s.hr} />;
}

const DEFAULT_IMAGES: CurriculumImages = {
  cover: "", butterChicken: "", palakPaneer: "", chanaMasala: "", spices: "",
};

// ── PAGES ──────────────────────────────────────────────────────────────

function CoverPage({ images }: { images: CurriculumImages }) {
  return (
    <Page size="A4" style={s.cover}>
      <Image src={images.cover} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }} />
      <View style={s.coverOverlay} />
      <View style={s.coverContent}>
        <Text style={s.coverEyebrow}>Spice &amp; Soul Academy</Text>
        <Text style={s.coverTitle}>Mastering the Classics</Text>
        <Text style={s.coverSubtitle}>Three Pillars of North Indian Cooking</Text>
        <View style={s.coverDivider} />
        <Text style={s.coverMeta}>
          {"Butter Chicken (Murgh Makhani)  ·  Palak Paneer  ·  Punjabi Chana Masala\n\n"}
          {"Professional Culinary Curriculum — Formal Approval Draft\n"}
          {"Prepared by: Ustad Hakeem, Executive Chef\n"}
          {"N K VENTURES, Bhopal  ·  May 2026"}
        </Text>
        <View style={s.coverBadge}>
          <Text style={s.coverBadgeText}>Version 1.0 — Final Draft</Text>
        </View>
      </View>
      <View style={s.coverFooter}>
        <Text style={s.coverFooterText}>hakeemrestro@gmail.com</Text>
        <Text style={s.coverFooterText}>+91 9406565799</Text>
        <Text style={s.coverFooterText}>hakeemrestro.shop</Text>
      </View>
    </Page>
  );
}

function CourseOverviewPage() {
  return (
    <Page size="A4" style={s.body}>
      <PageHeader title="Course Overview" chapter="Introduction" />
      <PageFooter />
      <View style={{ marginTop: 22 }}>
        <Eyebrow text="Section 1" />
        <Text style={s.h1}>Course Overview &amp; Objectives</Text>
        <HR />

        <Text style={s.h2}>Course Description</Text>
        <Text style={s.body1}>
          This course is a rigorous, technique-first curriculum built around three of the most iconic dishes in the North Indian culinary canon. Each recipe serves as a vehicle for learning transferable professional cooking skills — gravy architecture, spice management, protein treatment, and emulsion control — that underpin hundreds of Indian dishes.
        </Text>
        <Text style={s.body1}>
          The course is designed to elevate a competent home cook into a confident, technically literate culinary practitioner capable of producing restaurant-grade results consistently and safely.
        </Text>

        <Text style={s.h2}>Target Audience</Text>
        {[
          "Level: Intermediate — comfortable with basic knife skills and stovetop cooking",
          "Prior Knowledge: Basic familiarity with Indian pantry staples is an advantage",
          "Age Group: 18 and above",
          "Context: Home kitchen; no commercial equipment assumed",
        ].map((t) => <Bullet key={t} text={t} />)}

        <Text style={s.h2}>Core Culinary Skills Developed</Text>

        <Text style={s.h3}>🔥 Spice Science &amp; Tadka (Tempering)</Text>
        {[
          "Blooming whole spices in fat vs. dry toasting for powders — different mechanisms, different results",
          "Recognising doneness by sound, colour, and aroma — not timers",
          "Building layered spice profiles through sequential addition",
        ].map((t) => <Bullet key={t} text={t} />)}

        <Text style={s.h3}>🫕 Gravy Architecture</Text>
        {[
          "Onion-tomato base: the backbone of Butter Chicken and Chana Masala",
          "Cream/cashew emulsion: richness without breaking the sauce",
          "Spinach purée integration: preserving vivid colour and body in Palak Paneer",
          "Controlling consistency: reduction ratios and fat separation as quality signals",
        ].map((t) => <Bullet key={t} text={t} />)}

        <Text style={s.h3}>🥩 Protein Treatment &amp; Marination Chemistry</Text>
        {[
          "Double marination — yoghurt-acid first, spice-fat second — and why it works",
          "Tandoor simulation in a home oven (Maillard reaction without clay)",
          "How acid (yoghurt/lemon) denatures muscle fibre to improve texture and flavour absorption",
        ].map((t) => <Bullet key={t} text={t} />)}

        <Text style={s.h3}>⚖️ Flavour Balancing</Text>
        {[
          "Kasuri methi as a finishing agent to round bitterness",
          "Balancing tomato acidity with cream, butter, and sugar",
          "Adjusting chilli heat at different cooking stages",
        ].map((t) => <Bullet key={t} text={t} />)}

        <HR />
        <Text style={s.h2}>Course Structure</Text>

        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            {["Module", "Recipe", "Primary Skill", "Duration"].map((h) => (
              <View key={h} style={s.thCell}><Text style={s.thText}>{h}</Text></View>
            ))}
          </View>
          {[
            ["01", "Butter Chicken", "Marination, Makhani Sauce, Emulsion", "2.5 hrs"],
            ["02", "Palak Paneer", "Blanching, Purée Control, Paneer Handling", "1.5 hrs"],
            ["03", "Chana Masala", "Legume Cooking, Dry Masala, Finishing", "2 hrs"],
          ].map(([mod, rec, skill, dur], i) => (
            <View key={mod} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
              <View style={s.tdCell}><Text style={s.tdTextBold}>{mod}</Text></View>
              <View style={s.tdCell}><Text style={s.tdText}>{rec}</Text></View>
              <View style={s.tdCell}><Text style={s.tdText}>{skill}</Text></View>
              <View style={s.tdCell}><Text style={s.tdText}>{dur}</Text></View>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

function EquipmentPage() {
  return (
    <Page size="A4" style={s.body}>
      <PageHeader title="Equipment &amp; Pantry" chapter="Section 2" />
      <PageFooter />
      <View style={{ marginTop: 22 }}>
        <Eyebrow text="Section 2" />
        <Text style={s.h1}>Master Equipment &amp; Pantry</Text>
        <HR />

        <View style={s.row}>
          <View style={s.col2}>
            <Text style={s.h2}>Heavy Equipment</Text>
            {[
              "Heavy-bottomed kadai or Dutch oven (4–5 L)",
              "Cast iron or non-stick tawa",
              "High-powered blender (Vitamix or equivalent)",
              "Oven with grill/broil function",
              "Pressure cooker or Instant Pot",
              "Fine mesh strainer / chinois",
              "Mixing bowls (small, medium, large)",
            ].map((t) => <Bullet key={t} text={t} />)}

            <Text style={s.h2}>Small Utensils</Text>
            {[
              "Mortar and pestle",
              "Sharp chef's knife (20 cm / 8\") + paring knife",
              "Colour-coded cutting boards — separate for raw meat",
              "Measuring spoons (5 ml / 15 ml) and kitchen scale",
              "Instant-read thermometer (for chicken doneness)",
              "Metal skewers",
              "Ladle and slotted spoon",
            ].map((t) => <Bullet key={t} text={t} />)}
          </View>

          <View style={s.col2}>
            <Text style={s.h2}>Whole Spices</Text>
            {[
              "Cumin seeds (jeera)",
              "Coriander seeds (dhania)",
              "Green cardamom pods",
              "Black cardamom (badi elaichi)",
              "Cloves",
              "Cinnamon sticks",
              "Bay leaves (tej patta)",
              "Black peppercorns",
              "Kashmiri dried red chillies",
              "Fenugreek seeds (methi dana)",
              "Dried kasuri methi",
            ].map((t) => <Bullet key={t} text={t} />)}

            <Text style={s.h2}>Ground Spices &amp; Pastes</Text>
            {[
              "Kashmiri red chilli powder",
              "Turmeric powder (haldi)",
              "Cumin powder",
              "Coriander powder",
              "Garam masala (finishing spice only)",
              "Amchur (dried mango powder)",
              "Chaat masala",
              "Fresh ginger-garlic paste (50:50, always fresh)",
            ].map((t) => <Bullet key={t} text={t} />)}
          </View>
        </View>

        <HR />
        <Text style={s.h2}>Dairy &amp; Proteins</Text>
        <View style={s.row}>
          <View style={s.col2}>
            {["Full-fat plain yoghurt (thick, not runny)", "Double cream / heavy cream (35%+ fat)", "Unsalted butter (good quality)"].map((t) => <Bullet key={t} text={t} />)}
          </View>
          <View style={s.col2}>
            {["Fresh paneer (homemade preferred)", "Boneless chicken thighs (skin off) — thighs only", "Raw cashew nuts"].map((t) => <Bullet key={t} text={t} />)}
          </View>
        </View>

        <ChefNote text="Ginger-garlic paste must always be made fresh. Jarred paste contains preservatives and stale volatile oils that fundamentally alter the flavour of the finished dish. A 50:50 ratio (by weight) blended with a few drops of water is the standard." />
      </View>
    </Page>
  );
}

function ButterChickenDivider({ images }: { images: CurriculumImages }) {
  return (
    <Page size="A4" style={s.sectionDivider}>
      <Image src={images.butterChicken} style={s.dividerBg} />
      <View style={s.dividerOverlay} />
      <View style={s.dividerContent}>
        <Text style={s.dividerNumber}>01</Text>
        <Text style={s.dividerLabel}>Module One</Text>
        <Text style={s.dividerTitle}>Authentic Butter Chicken{"\n"}(Murgh Makhani)</Text>
        <Text style={s.dividerTagline}>The dish that defined Indian cuisine for the world</Text>
      </View>
    </Page>
  );
}

function ButterChickenPage1({ images }: { images: CurriculumImages }) {
  return (
    <Page size="A4" style={s.body}>
      <PageHeader title="Butter Chicken" chapter="Module 01" />
      <PageFooter />
      <View style={{ marginTop: 22 }}>
        <Image src={images.butterChicken} style={s.heroImage} />
        <Text style={s.heroCaption}>Murgh Makhani — velvety makhani sauce, charred tandoori chicken, finished with cream and kasuri methi</Text>

        <Eyebrow text="Module 01 · Authentic Butter Chicken" />
        <Text style={s.h1}>Murgh Makhani</Text>
        <Text style={s.body1}>
          Invented at Moti Mahal, Delhi in the 1950s, the original recipe was built on leftover tandoori chicken folded into a butter-tomato sauce enriched with cream. This curriculum version stays faithful: the chicken is cooked separately and added to a velvety, strained makhani sauce — not simmered raw in liquid.
        </Text>

        <StatBar items={[
          { label: "Marination", value: "4–12 hrs" },
          { label: "Cook Time", value: "50 min" },
          { label: "Servings", value: "4" },
          { label: "Difficulty", value: "⭐⭐⭐" },
        ]} />

        <HR />

        {/* Ingredients */}
        <Text style={s.h2}>Mise en Place — Ingredients</Text>

        <IngCategory text="Component A: First Marinade" />
        <IngTable rows={[
          { name: "Boneless chicken thighs (60g pieces)", metric: "800 g", imperial: "1 lb 12 oz" },
          { name: "Fresh lemon juice", metric: "30 ml", imperial: "2 tbsp" },
          { name: "Kashmiri red chilli powder", metric: "1 tsp / 3 g", imperial: "1 tsp" },
          { name: "Fine sea salt", metric: "1 tsp / 5 g", imperial: "1 tsp" },
        ]} />

        <IngCategory text="Component B: Second Marinade" />
        <IngTable rows={[
          { name: "Full-fat yoghurt, hung (strained)", metric: "120 g", imperial: "½ cup" },
          { name: "Fresh ginger-garlic paste", metric: "30 g / 2 tbsp", imperial: "2 tbsp" },
          { name: "Kashmiri red chilli powder", metric: "6 g / 2 tsp", imperial: "2 tsp" },
          { name: "Cumin powder", metric: "3 g / 1 tsp", imperial: "1 tsp" },
          { name: "Garam masala", metric: "3 g / 1 tsp", imperial: "1 tsp" },
          { name: "Turmeric powder", metric: "1.5 g / ½ tsp", imperial: "½ tsp" },
          { name: "Neutral oil", metric: "30 ml / 2 tbsp", imperial: "2 tbsp" },
        ]} />

        <IngCategory text="Component C: Makhani Sauce" />
        <IngTable rows={[
          { name: "Unsalted butter", metric: "60 g", imperial: "4 tbsp" },
          { name: "Medium white onions, roughly chopped", metric: "300 g / 2 medium", imperial: "10.5 oz" },
          { name: "Fresh ginger-garlic paste", metric: "30 g / 2 tbsp", imperial: "2 tbsp" },
          { name: "Ripe tomatoes OR tinned whole plum", metric: "600 g", imperial: "1 lb 5 oz" },
          { name: "Raw cashew nuts", metric: "30 g", imperial: "¼ cup" },
          { name: "Green cardamom pods (bruised)", metric: "4", imperial: "4" },
          { name: "Cloves", metric: "3", imperial: "3" },
          { name: "Cinnamon stick (5 cm)", metric: "1", imperial: "1" },
          { name: "Kashmiri red chilli powder", metric: "6 g / 2 tsp", imperial: "2 tsp" },
        ]} />

        <IngCategory text="Component D: Finishing" />
        <IngTable rows={[
          { name: "Double cream / heavy cream", metric: "120 ml", imperial: "½ cup" },
          { name: "Unsalted butter, cold, cubed", metric: "30 g", imperial: "2 tbsp" },
          { name: "Kasuri methi (dried fenugreek), crushed", metric: "2 tsp / 2 g", imperial: "2 tsp" },
          { name: "Garam masala (finishing)", metric: "½ tsp", imperial: "½ tsp" },
          { name: "Sugar (for acid balance, optional)", metric: "1 tsp", imperial: "1 tsp" },
        ]} />
      </View>
    </Page>
  );
}

function ButterChickenPage2() {
  return (
    <Page size="A4" style={s.body}>
      <PageHeader title="Butter Chicken" chapter="Module 01" />
      <PageFooter />
      <View style={{ marginTop: 22 }}>
        <Text style={s.h2}>Step-by-Step Execution</Text>

        <PhaseHeader text="Phase 1: Marination" />
        <Step n={1} text="Pat chicken pieces completely dry with kitchen paper. Any surface moisture = steam = no browning." />
        <Step n={2} text="First marinade: combine lemon juice, Kashmiri chilli, and salt in a large bowl. Add chicken. Toss to coat every surface. Rest 30 minutes at room temperature." />
        <Step n={3} text="Second marinade: add all Component B ingredients to the same bowl. Work the marinade into the chicken with gloved hands. Cover tightly. Refrigerate minimum 4 hours — overnight (12 hrs) strongly preferred." />
        <ChefNote text="Lemon juice (pH ~2.5) begins denaturing outer muscle proteins in the first marinade, opening channels for the spiced yoghurt to penetrate deeper. This is why a two-stage marinade produces noticeably more flavourful chicken." />

        <PhaseHeader text="Phase 2: Cooking the Chicken (Tikka Method)" />
        <Step n={1} text="Preheat oven to 240°C / 475°F / Gas 9 with grill/broil element on. Set a wire rack over a baking tray." />
        <Step n={2} text="Thread chicken onto metal skewers or lay on wire rack, pieces not touching." />
        <Step n={3} text="Grill on highest shelf for 12–15 minutes, turning once. Chicken must show visible char at the edges. Internal temperature must reach 74°C / 165°F." />
        <Step n={4} text="Rest on rack for 5 minutes before removing from skewers." />

        <View style={s.warningBox}>
          <Text style={s.warningText}>⚠ Food Safety: Internal temperature must reach 74°C / 165°F measured at the thickest point. No exceptions.</Text>
        </View>

        <ChefNote text="The char is not a mistake — it is the flavour. Slight bitterness from Maillard reaction products and minor carbonisation gives Murgh Makhani its complexity. Do not substitute by pan-frying." />

        <PhaseHeader text="Phase 3: Building the Makhani Sauce" />
        <Step n={1} text="Heat butter and oil in a large heavy pan over medium heat until butter foams and subsides." />
        <Step n={2} text="Add cardamom, cloves, cinnamon, and bay leaf. Bloom 45–60 seconds until fragrant — the sizzle will intensify then calm." />
        <Step n={3} text="Add onions with a pinch of salt. Cook on medium heat, stirring regularly, for 15–18 minutes until deep golden-brown. This step cannot be shortened." />
        <Step n={4} text="Add ginger-garlic paste. Fry 3–4 minutes until raw smell disappears and paste turns slightly golden." />
        <Step n={5} text="Add tomatoes and cashews. Add 150 ml water. Partially cover and simmer 20–25 minutes until thick and jammy." />
        <Step n={6} text="Remove cinnamon and bay leaf. Cool 10 minutes. Blend on maximum speed for 90 seconds until completely smooth." />
        <Step n={7} text="Pass through a fine mesh strainer back into the cleaned pan, pressing with a spatula. Discard solids." />

        <ChefNote text="Straining is the single technique that separates restaurant Makhani from home cooking. The strained sauce achieves a silky, velvety body with deepened colour. This step takes 3 minutes and the difference is immediately visible." />

        <PhaseHeader text="Phase 4: Finishing &amp; Assembly" />
        <Step n={1} text="Return strained sauce to medium-low heat. Add cream in a slow, steady stream, stirring constantly. Do not add cream to a violently boiling sauce." />
        <Step n={2} text="Add cold cubed butter one piece at a time, stirring in circular motion to emulsify (monte au beurre) — creates gloss and body." />
        <Step n={3} text="Crush kasuri methi between palms directly over the pan. Add garam masala. Adjust salt. If sharp/acidic, add ½ tsp sugar." />
        <Step n={4} text="Add cooked chicken tikka. Simmer gently on low heat for 5–8 minutes — enough to reheat through and absorb sauce, not long enough to toughen." />

        <HR />
        <Text style={s.h2}>Plating &amp; Presentation</Text>
        <Text style={s.body1}>Warm the serving bowl. Ladle sauce first, then arrange chicken with char marks facing up. Apply cream in a thin concentric circle from a squeeze bottle. Place 3–5 individual coriander leaves. Scatter crushed kasuri methi. Serve immediately with fresh naan or basmati rice.</Text>

        <HR />
        <Text style={s.h2}>Troubleshooting Guide</Text>
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            <View style={[s.thCell, { flex: 1.5 }]}><Text style={s.thText}>Issue</Text></View>
            <View style={[s.thCell, { flex: 2 }]}><Text style={s.thText}>Cause</Text></View>
            <View style={[s.thCell, { flex: 2 }]}><Text style={s.thText}>Fix</Text></View>
          </View>
          <TroubleRow issue="Sauce grainy / split" cause="Cream added to boiling sauce; or sauce boiled after cream" fix="Reduce heat before cream; whisk vigorously; add splash of warm water" />
          <TroubleRow issue="Chicken dry / tough" cause="Breast meat used; or over-cooked in oven" fix="Always use thighs; pull at 74°C internal temperature" alt />
          <TroubleRow issue="Sauce too thin" cause="Insufficient reduction or too much water" fix="Simmer uncovered until sauce coats the back of a spoon" />
          <TroubleRow issue="No char on chicken" cause="Oven not hot enough; too much moisture in marinade" fix="Maximum heat; drain excess marinade before grilling" alt />
          <TroubleRow issue="Sauce tastes flat" cause="Insufficient kasuri methi; skipped straining" fix="Add more crushed kasuri methi; never skip the straining step" />
        </View>
      </View>
    </Page>
  );
}

function PalakPaneerDivider({ images }: { images: CurriculumImages }) {
  return (
    <Page size="A4" style={s.sectionDivider}>
      <Image src={images.palakPaneer} style={s.dividerBg} />
      <View style={s.dividerOverlay} />
      <View style={s.dividerContent}>
        <Text style={s.dividerNumber}>02</Text>
        <Text style={s.dividerLabel}>Module Two</Text>
        <Text style={s.dividerTitle}>Traditional{"\n"}Palak Paneer</Text>
        <Text style={s.dividerTagline}>Colour, contrast, and the science of the perfect green</Text>
      </View>
    </Page>
  );
}

function PalakPaneerPage1({ images }: { images: CurriculumImages }) {
  return (
    <Page size="A4" style={s.body}>
      <PageHeader title="Palak Paneer" chapter="Module 02" />
      <PageFooter />
      <View style={{ marginTop: 22 }}>
        <Image src={images.palakPaneer} style={s.heroImage} />
        <Text style={s.heroCaption}>Palak Paneer — emerald spinach purée, golden-crusted paneer, finishing tadka of ghee and cumin</Text>

        <Eyebrow text="Module 02 · Traditional Palak Paneer" />
        <Text style={s.h1}>Palak Paneer</Text>
        <Text style={s.body1}>
          A masterclass in colour preservation, texture contrast, and restraint. The two most common failures — grey-brown spinach and rubbery paneer — are entirely preventable with correct technique. This version uses a blanch-and-shock method to lock in chlorophyll, and a separate paneer treatment (light frying followed by warm-water soak) that creates a golden crust with a soft interior.
        </Text>

        <StatBar items={[
          { label: "Prep Time", value: "20 min" },
          { label: "Cook Time", value: "35 min" },
          { label: "Servings", value: "4" },
          { label: "Difficulty", value: "⭐⭐" },
        ]} />

        <HR />

        <Text style={s.h2}>Mise en Place — Ingredients</Text>

        <IngCategory text="Component A: Spinach Purée" />
        <IngTable rows={[
          { name: "Fresh baby spinach, washed, stems trimmed", metric: "500 g", imperial: "1 lb 2 oz" },
          { name: "Fresh coriander leaves (optional)", metric: "20 g", imperial: "¾ oz" },
          { name: "Green chillies, roughly chopped", metric: "2–3 chillies", imperial: "2–3" },
          { name: "Ice + cold water (for shock bath)", metric: "Large bowl", imperial: "Large bowl" },
        ]} />

        <IngCategory text="Component B: Paneer" />
        <IngTable rows={[
          { name: "Fresh paneer, cut 3 cm cubes", metric: "350 g", imperial: "12 oz" },
          { name: "Neutral oil or ghee (for frying)", metric: "45 ml / 3 tbsp", imperial: "3 tbsp" },
          { name: "Turmeric powder", metric: "¼ tsp", imperial: "¼ tsp" },
        ]} />

        <IngCategory text="Component C: Gravy Base" />
        <IngTable rows={[
          { name: "Ghee", metric: "30 g / 2 tbsp", imperial: "2 tbsp" },
          { name: "Cumin seeds", metric: "3 g / 1 tsp", imperial: "1 tsp" },
          { name: "Medium white onion, finely diced", metric: "150 g / 1 medium", imperial: "5 oz" },
          { name: "Fresh ginger-garlic paste", metric: "22 g / 1.5 tbsp", imperial: "1.5 tbsp" },
          { name: "Ripe tomatoes, finely chopped", metric: "250 g / 2 medium", imperial: "9 oz" },
          { name: "Kashmiri red chilli powder", metric: "3 g / 1 tsp", imperial: "1 tsp" },
          { name: "Coriander powder", metric: "3 g / 1 tsp", imperial: "1 tsp" },
          { name: "Garam masala (finishing)", metric: "½ tsp", imperial: "½ tsp" },
        ]} />

        <IngCategory text="Component D: Finishing" />
        <IngTable rows={[
          { name: "Double cream", metric: "45 ml / 3 tbsp", imperial: "3 tbsp" },
          { name: "Butter", metric: "15 g / 1 tbsp", imperial: "1 tbsp" },
          { name: "Kasuri methi, crushed", metric: "1 tsp", imperial: "1 tsp" },
          { name: "Ghee (for finishing tadka)", metric: "15 g / 1 tbsp", imperial: "1 tbsp" },
          { name: "Whole dried red chilli (for tadka)", metric: "1", imperial: "1" },
        ]} />
      </View>
    </Page>
  );
}

function PalakPaneerPage2() {
  return (
    <Page size="A4" style={s.body}>
      <PageHeader title="Palak Paneer" chapter="Module 02" />
      <PageFooter />
      <View style={{ marginTop: 22 }}>
        <Text style={s.h2}>Step-by-Step Execution</Text>

        <PhaseHeader text="Phase 1: Spinach Blanching &amp; Purée" />
        <Step n={1} text="Set up ice bath before anything else: large bowl, cold water, full tray of ice. Must be ready before spinach enters the pot." />
        <Step n={2} text="Bring at least 3 litres of generously salted water to a rolling boil. Volume matters — less water drops temperature more when spinach enters." />
        <Step n={3} text="Add spinach (and coriander if using) in one go. Blanch for exactly 90 seconds. The leaves will wilt and turn vivid emerald green." />
        <Step n={4} text="Immediately plunge into the ice bath using a slotted spoon. Leave for 3 minutes until completely cold." />
        <Step n={5} text="Squeeze excess water from blanched spinach with your hands. Transfer to blender with green chillies and 2–3 tbsp blanching water. Blend to a smooth, thick, vibrant purée. Set aside." />

        <ChefNote text="Chlorophyll is degraded by prolonged heat and by organic acids naturally present in spinach. Blanching deactivates the enzymes (chlorophyllase) that break it down. Ice-shocking stops all cooking immediately. The result is jewel-bright emerald — not army drab. This step cannot be skipped or shortened." />

        <PhaseHeader text="Phase 2: Paneer Treatment" />
        <Step n={1} text="Toss paneer cubes gently with turmeric and a pinch of salt." />
        <Step n={2} text="Heat oil/ghee in a flat tawa over medium-high heat. Fry paneer in a single layer (do not crowd) for 2–3 minutes per side until golden-brown on at least two faces." />
        <Step n={3} text="Transfer fried paneer to a bowl of warm salted water. Soak for 10–15 minutes. Drain and pat dry before adding to gravy." />

        <ChefNote text="Soaking fried paneer in warm water rehydrates the compressed curd to a much softer texture — the technique used in professional kitchens. Homemade paneer (full-fat milk curdled with lemon juice, drained through muslin, pressed 30 minutes) is superior in every way and strongly encouraged." />

        <PhaseHeader text="Phase 3: Gravy Base (Bhuno Method)" />
        <Step n={1} text="Heat ghee and oil together in a kadai over medium heat. Add cumin seeds. Bloom 30 seconds until they darken one shade — the sizzle will intensify then calm." />
        <Step n={2} text="Add onions with a pinch of salt. Cook 12–14 minutes until deep golden-brown." />
        <Step n={3} text="Add ginger-garlic paste. Fry 3 minutes until raw smell dissipates." />
        <Step n={4} text="Add chopped tomatoes. Bhuno on medium heat 10–12 minutes, breaking down with the spoon, until oil pools at the surface (masala chhootna — definitive sign the masala is fully cooked)." />
        <Step n={5} text="Add Kashmiri chilli, coriander, cumin, and turmeric powders. Fry 2 minutes, stirring constantly." />

        <PhaseHeader text="Phase 4: Combining &amp; Finishing" />
        <Step n={1} text="Reduce heat to medium-low. Add spinach purée. Stir to combine. Add 100 ml warm water. Simmer 5–6 minutes on medium-low — do not use high heat, it will grey the spinach." />
        <Step n={2} text="Stir in cream and butter. Add crushed kasuri methi and garam masala. Adjust salt." />
        <Step n={3} text="Gently fold in paneer. Simmer on lowest heat for 3–4 minutes — paneer absorbs flavour but toughens if boiled hard." />
        <Step n={4} text="Finishing tadka: heat ghee in a small pan until shimmering. Add dried red chilli and cumin seeds (will splutter). After 15 seconds, pour over the finished dish and cover with a lid for 30 seconds." />

        <HR />
        <Text style={s.h2}>Troubleshooting Guide</Text>
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            <View style={[s.thCell, { flex: 1.5 }]}><Text style={s.thText}>Issue</Text></View>
            <View style={[s.thCell, { flex: 2 }]}><Text style={s.thText}>Cause</Text></View>
            <View style={[s.thCell, { flex: 2 }]}><Text style={s.thText}>Fix</Text></View>
          </View>
          <TroubleRow issue="Spinach grey / olive" cause="No blanch-shock; or high heat after adding purée" fix="Blanch-shock every time; always low heat after spinach goes in" />
          <TroubleRow issue="Paneer rubbery" cause="Old paneer; no warm soak; boiled in sauce" fix="Use fresh paneer; soak after frying; gentle simmer only" alt />
          <TroubleRow issue="Sauce too watery" cause="Spinach not squeezed thoroughly" fix="Squeeze spinach well; simmer uncovered to reduce" />
          <TroubleRow issue="Bitter taste" cause="Burned garlic or excess kasuri methi" fix="Garlic must be golden not dark; reduce kasuri methi quantity" alt />
        </View>
      </View>
    </Page>
  );
}

function ChanaMasalaDivider({ images }: { images: CurriculumImages }) {
  return (
    <Page size="A4" style={s.sectionDivider}>
      <Image src={images.chanaMasala} style={s.dividerBg} />
      <View style={s.dividerOverlay} />
      <View style={s.dividerContent}>
        <Text style={s.dividerNumber}>03</Text>
        <Text style={s.dividerLabel}>Module Three</Text>
        <Text style={s.dividerTitle}>Classic Punjabi{"\n"}Chana Masala</Text>
        <Text style={s.dividerTagline}>Dark, bold, earthy — the soul of Punjabi cooking</Text>
      </View>
    </Page>
  );
}

function ChanaMasalaPage1({ images }: { images: CurriculumImages }) {
  return (
    <Page size="A4" style={s.body}>
      <PageHeader title="Chana Masala" chapter="Module 03" />
      <PageFooter />
      <View style={{ marginTop: 22 }}>
        <Image src={images.chanaMasala} style={s.heroImage} />
        <Text style={s.heroCaption}>Punjabi Chana Masala — dark mahogany gravy, tea-darkened chickpeas, finished with amchur and fresh ginger julienne</Text>

        <Eyebrow text="Module 03 · Classic Punjabi Chana Masala" />
        <Text style={s.h1}>Punjabi Chana Masala</Text>
        <Text style={s.body1}>
          Authentic Punjabi Chana Masala is dark, bold, and earthy — dramatically different from the pale, creamy versions found outside India. The characteristic near-black colour and acidic depth come from dried chickpeas cooked with black tea, amchur (dried mango powder), and a dark-roasted freshly ground spice blend. This recipe does not use tinned chickpeas.
        </Text>

        <StatBar items={[
          { label: "Soak + Cook", value: "10+ hrs" },
          { label: "Active Cook", value: "60 min" },
          { label: "Servings", value: "4–6" },
          { label: "Difficulty", value: "⭐⭐⭐" },
        ]} />

        <HR />
        <Text style={s.h2}>Mise en Place — Ingredients</Text>

        <IngCategory text="Component A: Chickpeas" />
        <IngTable rows={[
          { name: "Dried kabuli chana (white chickpeas)", metric: "300 g dry", imperial: "1½ cups" },
          { name: "Baking soda (for soaking)", metric: "½ tsp", imperial: "½ tsp" },
          { name: "Black tea bags (plain, unflavoured)", metric: "2 bags", imperial: "2 bags" },
          { name: "Water for pressure cooking", metric: "1 litre", imperial: "4 cups" },
          { name: "Salt (added to cooking water)", metric: "1 tsp", imperial: "1 tsp" },
        ]} />

        <IngCategory text="Component B: Fresh-Ground Chana Masala Blend" />
        <IngTable rows={[
          { name: "Cumin seeds", metric: "9 g / 1 tbsp", imperial: "1 tbsp" },
          { name: "Coriander seeds", metric: "9 g / 1 tbsp", imperial: "1 tbsp" },
          { name: "Black cardamom pods", metric: "2 pods", imperial: "2 pods" },
          { name: "Cloves", metric: "4", imperial: "4" },
          { name: "Black peppercorns", metric: "5 g / 1 tsp", imperial: "1 tsp" },
          { name: "Kashmiri dried red chilli", metric: "2", imperial: "2" },
        ]} />

        <ChefNote text="Dry-toast all spices together in a hot dry pan for 90 seconds until one shade darker and very fragrant. Grind immediately in a spice grinder or mortar. Made fresh per session — pre-ground spice blends lose 60–70% of volatile aromatics within weeks of opening." />

        <IngCategory text="Component C: Masala Base" />
        <IngTable rows={[
          { name: "Neutral oil", metric: "60 ml / 4 tbsp", imperial: "4 tbsp" },
          { name: "Large white onions, very finely diced", metric: "350 g / 2 large", imperial: "12 oz" },
          { name: "Fresh ginger-garlic paste", metric: "30 g / 2 tbsp", imperial: "2 tbsp" },
          { name: "Green chillies, slit", metric: "2–3", imperial: "2–3" },
          { name: "Ripe tomatoes, very finely chopped", metric: "400 g", imperial: "14 oz" },
          { name: "Kashmiri red chilli powder", metric: "4.5 g / 1.5 tsp", imperial: "1.5 tsp" },
          { name: "Turmeric powder", metric: "½ tsp", imperial: "½ tsp" },
          { name: "Amchur (dried mango powder)", metric: "4.5 g / 1.5 tsp", imperial: "1.5 tsp" },
        ]} />

        <IngCategory text="Garnish" />
        <IngTable rows={[
          { name: "Fresh ginger, julienned", metric: "5 cm piece", imperial: "2\" piece" },
          { name: "Green chilli, finely sliced", metric: "1", imperial: "1" },
          { name: "Fresh coriander, roughly torn", metric: "generous handful", imperial: "generous handful" },
          { name: "Chaat masala", metric: "½ tsp", imperial: "½ tsp" },
          { name: "Lemon, halved", metric: "1", imperial: "1" },
        ]} />
      </View>
    </Page>
  );
}

function ChanaMasalaPage2() {
  return (
    <Page size="A4" style={s.body}>
      <PageHeader title="Chana Masala" chapter="Module 03" />
      <PageFooter />
      <View style={{ marginTop: 22 }}>
        <Text style={s.h2}>Step-by-Step Execution</Text>

        <PhaseHeader text="Phase 1: Soaking &amp; Cooking Chickpeas" />
        <Step n={1} text="Rinse dried chickpeas under cold water until water runs clear. Place in a large bowl. Cover with cold water 8 cm above chickpeas. Add baking soda. Soak 8–12 hours (overnight)." />
        <Step n={2} text="Drain and rinse thoroughly. Place in pressure cooker. Add 1 litre cold water, both tea bags, and salt." />
        <Step n={3} text="Pressure cook 25–30 minutes (conventional) or 35 minutes High Pressure (Instant Pot). Allow natural pressure release (10–15 minutes) — forced release splits skins." />
        <Step n={4} text="Remove tea bags. Reserve ALL cooking liquid in a separate bowl — this is the darkening agent and starch base for your gravy." />
        <Step n={5} text="Doneness check: chickpea must be fully tender with no resistance when pressed between thumb and forefinger. If not, cook a further 10 minutes." />

        <ChefNote text="Baking soda alkalinises the soaking water, breaking down pectin in the chickpea skins and significantly reducing cooking time. The tea bags infuse tannins as chickpeas cook, naturally darkening the skins — the key to authentic Chana Masala's colour without artificial colouring." />

        <PhaseHeader text="Phase 2: Building the Dark Masala" />
        <Step n={1} text="Heat oil in a large heavy kadai over medium-high heat. Add finely diced onions and a pinch of salt." />
        <Step n={2} text="Cook stirring frequently for 20–25 minutes until onions reach deep mahogany-brown — approaching the colour of dark caramel. This cannot be rushed. This caramelisation is what gives Chana Masala its characteristic dark colour." />
        <Step n={3} text="Add slit green chillies. Cook 2 minutes. Add ginger-garlic paste. Fry 4 minutes until fully integrated." />
        <Step n={4} text="Add finely chopped tomatoes. Bhuno on medium-high heat 15–18 minutes stirring frequently until oil separates completely and mixture is very dark, thick, and jammy." />
        <Step n={5} text="Add Kashmiri chilli and turmeric. Fry 2 minutes. Add the freshly ground Chana Masala spice blend. Fry 3 minutes stirring constantly." />

        <PhaseHeader text="Phase 3: Combining &amp; Simmering" />
        <Step n={1} text="Add cooked chickpeas to masala. Stir thoroughly so every chickpea is coated." />
        <Step n={2} text="Mash approximately 15–20% of the chickpeas against the side of the pan. Released starch naturally thickens the gravy without flour or cornflour." />
        <Step n={3} text="Add 300 ml reserved cooking liquid. Stir to fully incorporate. Bring to a gentle boil, reduce to a steady simmer for 20–25 minutes, stirring every few minutes." />
        <Step n={4} text="Add amchur. Taste — pronounced tangy, fruity sourness should be present. Adjust salt. Finish with a squeeze of half a lemon directly into the pan." />
        <Step n={5} text="Consistency check: gravy should cling to chickpeas and hold shape on a plate — not dry, not loose. Adjust with cooking liquid if needed." />

        <HR />
        <Text style={s.h2}>Plating &amp; Presentation</Text>
        <Text style={s.body1}>Serve in a karahi or rustic bowl. Arrange julienned ginger in a V-shape on top — it will be eaten, not discarded. Fan green chilli slices along one edge. Pile torn coriander at the centre. Dust lightly with chaat masala. Place half-lemon beside the bowl. Serve with puri or bhatura for traditional Punjabi experience.</Text>

        <HR />
        <Text style={s.h2}>Troubleshooting Guide</Text>
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            <View style={[s.thCell, { flex: 1.5 }]}><Text style={s.thText}>Issue</Text></View>
            <View style={[s.thCell, { flex: 2 }]}><Text style={s.thText}>Cause</Text></View>
            <View style={[s.thCell, { flex: 2 }]}><Text style={s.thText}>Fix</Text></View>
          </View>
          <TroubleRow issue="Chickpeas still firm" cause="Under-soaked; old dried chickpeas; hard water" fix="Soak min 8 hours; use baking soda; use filtered water" />
          <TroubleRow issue="Masala not dark" cause="Onions under-cooked" fix="No shortcut — cook onions to deep mahogany every time" alt />
          <TroubleRow issue="Gravy too thin" cause="Insufficient reduction; too few chickpeas mashed" fix="Simmer uncovered; mash more chickpeas against pan side" />
          <TroubleRow issue="Dish tastes flat" cause="Amchur insufficient; spices not fresh-ground" fix="Add more amchur; always grind spice blend fresh" alt />
          <TroubleRow issue="Chickpea skins split" cause="Pressure released too quickly" fix="Always natural pressure release — never quick-release for legumes" />
        </View>
      </View>
    </Page>
  );
}

function AssessmentPage() {
  return (
    <Page size="A4" style={s.body}>
      <PageHeader title="Assessment Rubric" chapter="Section 4" />
      <PageFooter />
      <View style={{ marginTop: 22 }}>
        <Eyebrow text="Section 4" />
        <Text style={s.h1}>Assessment &amp; Approval Rubric</Text>
        <HR />

        <Text style={s.body1}>
          Students are assessed on all three dishes prepared independently in a timed practical session of 3 hours. Each dish is scored separately. All food safety checkpoints are pass/fail regardless of culinary score.
        </Text>

        <Text style={s.h2}>Module 01 — Butter Chicken (35 marks)</Text>
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            <View style={[s.thCell, s.rubricCrit]}><Text style={s.thText}>Criterion</Text></View>
            <View style={[s.thCell, s.rubricMarks]}><Text style={s.thText}>Marks</Text></View>
            <View style={[s.thCell, s.rubricDesc]}><Text style={s.thText}>Descriptor</Text></View>
          </View>
          {[
            ["Chicken texture", "8", "8: Succulent, char visible, not dry. 5–7: Minor dryness. <5: Dry, tough, or raw"],
            ["Sauce colour & body", "7", "7: Deep terracotta, silky, strained. 4–6: Correct colour, uneven body. <4: Pale or grey"],
            ["Flavour balance", "10", "10: Rich, smoky, tangy, aromatic, well-salted. Reduce with each noted imbalance"],
            ["Cream emulsion", "5", "5: Fully integrated, glossy. 3: Slight separation. 0–2: Split or curdled"],
            ["Presentation", "5", "Cream swirl, coriander placement, bowl warmth, service readiness"],
          ].map(([crit, marks, desc], i) => (
            <View key={crit} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
              <View style={[s.tdCell, s.rubricCrit]}><Text style={s.tdTextBold}>{crit}</Text></View>
              <View style={[s.tdCell, s.rubricMarks]}><Text style={s.tdText}>{marks}</Text></View>
              <View style={[s.tdCell, s.rubricDesc]}><Text style={s.tdText}>{desc}</Text></View>
            </View>
          ))}
        </View>

        <Text style={s.h2}>Module 02 — Palak Paneer (30 marks)</Text>
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            <View style={[s.thCell, s.rubricCrit]}><Text style={s.thText}>Criterion</Text></View>
            <View style={[s.thCell, s.rubricMarks]}><Text style={s.thText}>Marks</Text></View>
            <View style={[s.thCell, s.rubricDesc]}><Text style={s.thText}>Descriptor</Text></View>
          </View>
          {[
            ["Spinach colour", "10", "10: Vivid emerald green. 6–9: Slightly dull but acceptable. <6: Grey or olive — fundamental technique failure"],
            ["Paneer texture", "8", "8: Golden crust, soft interior. 5–7: Minor texture issues. <5: Hard or chewy"],
            ["Masala integration", "7", "Masala fully cooked through, no raw spice taste, bhuno technique evident"],
            ["Presentation", "5", "Garnish quality, colour contrast, bowl choice"],
          ].map(([crit, marks, desc], i) => (
            <View key={crit} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
              <View style={[s.tdCell, s.rubricCrit]}><Text style={s.tdTextBold}>{crit}</Text></View>
              <View style={[s.tdCell, s.rubricMarks]}><Text style={s.tdText}>{marks}</Text></View>
              <View style={[s.tdCell, s.rubricDesc]}><Text style={s.tdText}>{desc}</Text></View>
            </View>
          ))}
        </View>

        <Text style={s.h2}>Module 03 — Chana Masala (35 marks)</Text>
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            <View style={[s.thCell, s.rubricCrit]}><Text style={s.thText}>Criterion</Text></View>
            <View style={[s.thCell, s.rubricMarks]}><Text style={s.thText}>Marks</Text></View>
            <View style={[s.thCell, s.rubricDesc]}><Text style={s.thText}>Descriptor</Text></View>
          </View>
          {[
            ["Chickpea texture", "8", "8: Tender throughout, no split skins. 5–7: Slightly firm. <5: Hard or mushy"],
            ["Masala depth & colour", "10", "10: Dark mahogany, complex flavour. 6–9: Acceptable. <6: Pale, thin, or flat"],
            ["Acidity balance", "7", "Correct tangy finish from amchur/lemon, no sharpness or flatness"],
            ["Consistency", "5", "Gravy clings to chickpeas, correct thickness — not dry, not watery"],
            ["Presentation & garnish", "5", "Ginger julienne, coriander, lemon, chaat masala — all present and placed correctly"],
          ].map(([crit, marks, desc], i) => (
            <View key={crit} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
              <View style={[s.tdCell, s.rubricCrit]}><Text style={s.tdTextBold}>{crit}</Text></View>
              <View style={[s.tdCell, s.rubricMarks]}><Text style={s.tdText}>{marks}</Text></View>
              <View style={[s.tdCell, s.rubricDesc]}><Text style={s.tdText}>{desc}</Text></View>
            </View>
          ))}
        </View>

        <HR />
        <Text style={s.h2}>Grading Scale</Text>
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            {["Score", "Grade", "Descriptor"].map((h) => (
              <View key={h} style={s.thCell}><Text style={s.thText}>{h}</Text></View>
            ))}
          </View>
          {[
            ["90–100", "Distinction", "Restaurant-ready. Minor refinements only."],
            ["75–89", "Merit", "Competent execution with identifiable areas to develop"],
            ["60–74", "Pass", "Fundamentally correct but inconsistent in one or more modules"],
            ["< 60", "Repeat Assessment", "Fundamental technique gaps require additional supervised practice"],
          ].map(([score, grade, desc], i) => (
            <View key={score} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
              <View style={s.tdCell}><Text style={s.tdTextBold}>{score}</Text></View>
              <View style={s.tdCell}><Text style={s.tdText}>{grade}</Text></View>
              <View style={s.tdCell}><Text style={s.tdText}>{desc}</Text></View>
            </View>
          ))}
        </View>

        <View style={s.warningBox}>
          <Text style={s.warningText}>⚠ Food Safety: Any food safety failure is an automatic fail of the entire assessment regardless of culinary score. Safety is non-negotiable. Mandatory checks: raw chicken on designated board only · internal temperature ≥74°C / 165°F confirmed · hands washed between protein and other ingredients · dairy added correctly · workstation clean throughout.</Text>
        </View>

        <HR />
        <Text style={[s.body2, { textAlign: "center", marginTop: 20, color: C.clove400 }]}>
          {"Spice & Soul Academy  ·  N K VENTURES  ·  Shop No. 03, Plot No. 84, MP Nagar Zone II, Bhopal, MP — 462016\n"}
          {"hakeemrestro@gmail.com  ·  +91 9406565799  ·  hakeemrestro.shop"}
        </Text>
      </View>
    </Page>
  );
}

// ── Main Document Export ────────────────────────────────────────────────

export function CurriculumPdf({ images = DEFAULT_IMAGES }: { images?: CurriculumImages }) {
  return (
    <Document
      title="Mastering the Classics — Spice & Soul Academy Curriculum"
      author="Ustad Hakeem — N K VENTURES"
      subject="Professional Culinary Course Curriculum"
      creator="Spice & Soul Academy"
      keywords="Indian cooking, curriculum, Butter Chicken, Palak Paneer, Chana Masala"
    >
      <CoverPage images={images} />
      <CourseOverviewPage />
      <EquipmentPage />
      <ButterChickenDivider images={images} />
      <ButterChickenPage1 images={images} />
      <ButterChickenPage2 />
      <PalakPaneerDivider images={images} />
      <PalakPaneerPage1 images={images} />
      <PalakPaneerPage2 />
      <ChanaMasalaDivider images={images} />
      <ChanaMasalaPage1 images={images} />
      <ChanaMasalaPage2 />
      <AssessmentPage />
    </Document>
  );
}
