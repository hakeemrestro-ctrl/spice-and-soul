import { resend } from "@/lib/resend";
import { generateInvoicePdf } from "@/lib/invoice";
import { generateRecipePdf } from "@/lib/generate-recipe-pdf";
import { PurchaseConfirmationEmail } from "@/components/email-templates/purchase-confirmation";
import { createElement } from "react";
import type { Course, Recipe } from "@/types";

type ChildCourse = {
  course: Course;
  recipes: Recipe[];
};

type SendCourseEmailInput = {
  customerEmail: string;
  customerName: string;
  course: Course;
  recipes: Recipe[];
  priceCents: number;
  invoiceNumber: string;
  last4?: string;
  resendUrl: string;
  bundleChildren?: ChildCourse[];
  gift?: {
    senderName: string;
    message: string | null;
  };
};

export async function sendCourseEmail(input: SendCourseEmailInput): Promise<void> {
  const {
    customerEmail,
    customerName,
    course,
    recipes,
    priceCents,
    invoiceNumber,
    last4,
    resendUrl,
    bundleChildren,
    gift,
  } = input;

  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const safeFilename = (s: string) =>
    s.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase();

  // Bundle: render N child course PDFs + 1 combined invoice
  const recipeJobs =
    bundleChildren && bundleChildren.length > 0
      ? bundleChildren.map((child) =>
          generateRecipePdf({
            course: child.course,
            recipes: child.recipes,
            customerName,
          }).then((buffer) => ({
            filename: `${safeFilename(child.course.title)}-recipes.pdf`,
            content: buffer,
          })),
        )
      : [
          generateRecipePdf({ course, recipes, customerName }).then((buffer) => ({
            filename: `${safeFilename(course.title)}-recipes.pdf`,
            content: buffer,
          })),
        ];

  // Gifts: skip invoice (recipient didn't pay; sender already has their own).
  const invoicePdf = gift
    ? null
    : await generateInvoicePdf({
        invoiceNumber,
        date,
        customerName,
        customerEmail,
        courseTitle: course.title,
        priceCents,
        last4,
        accessUrl: resendUrl,
      });
  const recipePdfs = await Promise.all(recipeJobs);

  const totalRecipes =
    bundleChildren && bundleChildren.length > 0
      ? bundleChildren.reduce(
          (n, c) => n + (c.recipes.length || c.course.recipe_count),
          0,
        )
      : recipes.length || course.recipe_count;

  await resend.emails.send({
    from: "Spice & Soul Academy <hello@spiceandsoul.com>",
    replyTo: "support@spiceandsoul.com",
    to: customerEmail,
    subject: gift
      ? `${gift.senderName} sent you a gift — ${course.title}`
      : `Your ${course.title} recipe book is here`,
    react: createElement(PurchaseConfirmationEmail, {
      customerName,
      courseTitle: course.title,
      recipeCount: totalRecipes,
      resendUrl,
      childCourseTitles: bundleChildren?.map((c) => c.course.title),
      giftFromName: gift?.senderName,
      giftMessage: gift?.message,
    }),
    attachments: [
      ...recipePdfs,
      ...(invoicePdf
        ? [{ filename: `invoice-${invoiceNumber}.pdf`, content: invoicePdf }]
        : []),
    ],
  });
}
