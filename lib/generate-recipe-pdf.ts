import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { RecipePdf } from "@/components/recipe-pdf";
import { registerPdfFonts } from "@/lib/pdf-fonts";
import type { Course, Recipe } from "@/types";

type RecipePdfInput = {
  course: Course;
  recipes: Recipe[];
  customerName: string;
};

export async function generateRecipePdf(input: RecipePdfInput): Promise<Buffer> {
  registerPdfFonts();
  const { course, recipes, customerName } = input;

  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(RecipePdf, { course, recipes, customerName, date }) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
