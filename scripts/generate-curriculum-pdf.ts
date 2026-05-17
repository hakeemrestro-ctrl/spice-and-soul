/**
 * Generate the Spice & Soul Academy culinary curriculum PDF.
 * Run: pnpm exec tsx scripts/generate-curriculum-pdf.ts
 * Output: ~/Desktop/SpiceSoul_Curriculum_2026.pdf
 */

import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Font } from "@react-pdf/renderer";

// ── Register fonts ──────────────────────────────────────────────────────
Font.register({
  family: "DM Serif Display",
  fonts: [
    { src: "https://fonts.gstatic.com/s/dmserifdisplay/v17/-nFnOHM81r4j6k0gjAW3mujVU2B2K_c.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/dmserifdisplay/v17/-nFhOHM81r4j6k0gjAW3mujVU2B2G_Vx1w.ttf", fontWeight: 400, fontStyle: "italic" as const },
  ],
});
Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf", fontWeight: 500 },
    { src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf", fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word: string) => [word]);

import { CurriculumPdf } from "../components/curriculum-pdf";

// ── Fetch image as base64 data URI ──────────────────────────────────────
async function fetchImageAsDataUri(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  if (!resp.ok) throw new Error(`Image fetch failed: ${url} (${resp.status})`);
  const arrayBuf = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");
  const mime = resp.headers.get("content-type") ?? "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

const IMAGE_URLS = {
  // Vibrant Indian food/spice spread — cover backdrop
  cover:         "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=1200&q=80&fit=crop&crop=entropy",
  // Chicken tikka masala / murgh makhani — orange-red cream sauce with naan (#1 murgh makhani result)
  butterChicken: "https://images.unsplash.com/photo-1772730064970-a7b2735c93b9?w=1000&q=80&fit=crop&crop=entropy",
  // Palak paneer — spinach curry with paneer (#1 palak paneer search result)
  palakPaneer:   "https://images.unsplash.com/photo-1589647363585-f4a7d3877b10?w=1000&q=80&fit=crop&crop=entropy",
  // Chana masala — dark chickpea curry (#1 chana masala search result on Unsplash)
  chanaMasala:   "https://images.unsplash.com/photo-1587033649773-5c231faa21e3?w=1000&q=80&fit=crop&crop=entropy",
  // Warm spice composition — pantry reference
  spices:        "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=1000&q=80&fit=crop&crop=entropy",
};

async function main() {
  console.log("⏳  Fetching images...");

  const [cover, butterChicken, palakPaneer, chanaMasala, spices] = await Promise.all([
    fetchImageAsDataUri(IMAGE_URLS.cover),
    fetchImageAsDataUri(IMAGE_URLS.butterChicken),
    fetchImageAsDataUri(IMAGE_URLS.palakPaneer),
    fetchImageAsDataUri(IMAGE_URLS.chanaMasala),
    fetchImageAsDataUri(IMAGE_URLS.spices),
  ]);

  console.log("✓   Images fetched. Rendering PDF...");

  const images = { cover, butterChicken, palakPaneer, chanaMasala, spices };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(CurriculumPdf, { images }) as any;
  const buffer = await renderToBuffer(element);

  const outputPath = join(homedir(), "Desktop", "SpiceSoul_Curriculum_2026.pdf");
  writeFileSync(outputPath, Buffer.from(buffer));

  console.log(`\n✅  PDF saved → ${outputPath}`);
  console.log(`    Size: ${(buffer.byteLength / 1024).toFixed(1)} KB · 13 pages`);
}

main().catch((err) => {
  console.error("❌  Failed:", err?.message ?? err);
  process.exit(1);
});
