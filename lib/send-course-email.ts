import { resend } from "@/lib/resend";
import { generateInvoicePdf } from "@/lib/invoice";
import { generateRecipePdf } from "@/lib/generate-recipe-pdf";
import { PurchaseConfirmationEmail } from "@/components/email-templates/purchase-confirmation";
import { InvoiceEmail } from "@/components/email-templates/invoice-email";
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

const FROM_ADDRESS = "Spice & Soul Academy <hello@hakeemrestro.shop>";
const REPLY_TO = "hakeemrestro@gmail.com";

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase();
}

/**
 * Orchestrates post-payment email delivery.
 *
 * Sends TWO separate emails (per user requirement):
 *   1. Welcome — course/recipe PDF attachment(s) + getting-started copy
 *   2. Invoice — invoice PDF attachment + formal receipt copy
 *
 * Welcome fires FIRST (the "money moment" — user opens email, sees content
 * they paid for). Invoice arrives shortly after as an email-of-record.
 *
 * Each sender has its own try/catch so one failure does not block the
 * other. PDFs are generated ONCE up front and passed to both senders so
 * we never duplicate the (expensive) @react-pdf/renderer work.
 *
 * Gift orders skip the invoice email — the recipient didn't pay; the
 * sender already has their own purchase email with the invoice.
 *
 * Throws only if BOTH emails fail. Caller (fulfillOrder in the Paytm
 * callback route) treats throw as fulfillment failure → flags
 * pending_orders.resp_msg for admin retry.
 */
export async function sendCourseEmail(input: SendCourseEmailInput): Promise<void> {
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Pre-generate all PDFs ONCE. Senders receive the already-rendered buffers.
  const recipePdfs = await renderRecipePdfs(input);
  const invoicePdf = input.gift
    ? null
    : await generateInvoicePdf({
        invoiceNumber: input.invoiceNumber,
        date,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        courseTitle: input.course.title,
        priceCents: input.priceCents,
        last4: input.last4,
        accessUrl: input.resendUrl,
      });

  let welcomeOk = false;
  let invoiceOk = false;
  const errors: Error[] = [];

  // 1. Welcome FIRST (course content — the high-value email).
  try {
    await sendWelcomeEmail({ input, recipePdfs });
    welcomeOk = true;
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[email:welcome] failed", {
      invoiceNumber: input.invoiceNumber,
      customerEmail: input.customerEmail,
      message: e.message,
    });
    errors.push(new Error(`welcome: ${e.message}`));
  }

  // 2. Invoice SECOND (record-of-purchase). Skipped for gifts.
  if (invoicePdf) {
    try {
      await sendInvoiceEmail({ input, invoicePdf, date });
      invoiceOk = true;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error("[email:invoice] failed", {
        invoiceNumber: input.invoiceNumber,
        customerEmail: input.customerEmail,
        message: e.message,
      });
      errors.push(new Error(`invoice: ${e.message}`));
    }
  } else {
    // Gift path — no invoice email is intentional, not a failure.
    invoiceOk = true;
  }

  // Fail loud only if BOTH attempts failed. One-of-two success means
  // customer still got their content (welcome) OR at least their record
  // (invoice). Better to log + continue than to mark whole fulfillment
  // failed and trigger admin retry that re-sends a duplicate.
  if (!welcomeOk && !invoiceOk) {
    throw new Error(
      `Both emails failed: ${errors.map((e) => e.message).join("; ")}`,
    );
  }
}

// -- Welcome email -----------------------------------------------------------

type WelcomeArgs = {
  input: SendCourseEmailInput;
  recipePdfs: { filename: string; content: Buffer }[];
};

async function sendWelcomeEmail({ input, recipePdfs }: WelcomeArgs): Promise<void> {
  const {
    customerEmail,
    customerName,
    course,
    recipes,
    resendUrl,
    bundleChildren,
    gift,
  } = input;

  const totalRecipes =
    bundleChildren && bundleChildren.length > 0
      ? bundleChildren.reduce(
          (n, c) => n + (c.recipes.length || c.course.recipe_count),
          0,
        )
      : recipes.length || course.recipe_count;

  await resend.emails.send({
    from: FROM_ADDRESS,
    replyTo: REPLY_TO,
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
    attachments: recipePdfs,
  });
}

// -- Invoice email -----------------------------------------------------------

type InvoiceArgs = {
  input: SendCourseEmailInput;
  invoicePdf: Buffer;
  date: string;
};

async function sendInvoiceEmail({
  input,
  invoicePdf,
  date,
}: InvoiceArgs): Promise<void> {
  const {
    customerEmail,
    customerName,
    course,
    priceCents,
    invoiceNumber,
    last4,
    resendUrl,
  } = input;

  await resend.emails.send({
    from: FROM_ADDRESS,
    replyTo: REPLY_TO,
    to: customerEmail,
    subject: `Invoice ${invoiceNumber} — ${course.title}`,
    react: createElement(InvoiceEmail, {
      customerName,
      customerEmail,
      invoiceNumber,
      date,
      courseTitle: course.title,
      priceCents,
      last4,
      resendUrl,
    }),
    attachments: [
      { filename: `invoice-${invoiceNumber}.pdf`, content: invoicePdf },
    ],
  });
}

// -- PDF rendering helpers ---------------------------------------------------

async function renderRecipePdfs(
  input: SendCourseEmailInput,
): Promise<{ filename: string; content: Buffer }[]> {
  const { course, recipes, customerName, bundleChildren } = input;

  // Bundle: render N child course PDFs.
  if (bundleChildren && bundleChildren.length > 0) {
    return Promise.all(
      bundleChildren.map((child) =>
        generateRecipePdf({
          course: child.course,
          recipes: child.recipes,
          customerName,
        }).then((buffer) => ({
          filename: `${safeFilename(child.course.title)}-recipes.pdf`,
          content: buffer,
        })),
      ),
    );
  }

  // Single course.
  const buffer = await generateRecipePdf({ course, recipes, customerName });
  return [
    {
      filename: `${safeFilename(course.title)}-recipes.pdf`,
      content: buffer,
    },
  ];
}
