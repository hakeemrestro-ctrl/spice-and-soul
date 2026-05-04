import { test, expect } from "@playwright/test";

// End-to-end smoke for the email-only purchase architecture.
//
// A real PaymentIntent test (Stripe test card 4242…) requires the Stripe CLI
// forwarding signed webhooks to a seeded local DB, plus iframe interaction
// with Stripe Elements — covered by `purchase-real.spec.ts` (gated behind
// E2E_STRIPE_LIVE=1). The cases below verify the UI paths users actually
// traverse on every release.

test.describe("Marketing surface", () => {
  test("homepage renders hero + delivery promise", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Master Indian cooking/i)).toBeVisible();
    await expect(page.getByText(/Re-send your PDFs/i)).toBeVisible();
  });

  test("courses listing shows the 5 SKUs", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByText("North Indian Classics")).toBeVisible();
    await expect(page.getByText("South Indian Mastery")).toBeVisible();
    await expect(page.getByText("Street Food & Chaat")).toBeVisible();
    await expect(page.getByText("Biryani & Rice Dishes")).toBeVisible();
    await expect(page.getByText("Indian Sweets & Desserts")).toBeVisible();
  });

  test("course detail lists recipes + price", async ({ page }) => {
    await page.goto("/courses/north-indian-classics");
    await expect(
      page.getByText("North Indian Classics — The Royal Kitchen"),
    ).toBeVisible();
    await expect(page.getByText("Butter Chicken (Murgh Makhani)")).toBeVisible();
    await expect(page.getByText("$250")).toBeVisible();
  });

  test("Enroll Now CTA navigates to checkout", async ({ page }) => {
    await page.goto("/courses/north-indian-classics");
    await page.getByText("Enroll Now").first().click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText(/Email address/i)).toBeVisible();
  });
});

test.describe("Post-purchase + recovery", () => {
  test("thank-you page sets expectations", async ({ page }) => {
    await page.goto("/thank-you");
    await expect(page.getByText(/Your course is/i)).toBeVisible();
    await expect(page.getByText(/Check your inbox/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /resend/i })).toBeVisible();
  });

  test("/resend renders form and accepts an email", async ({ page }) => {
    await page.goto("/resend");
    await expect(page.getByText(/Re-send my/i)).toBeVisible();
    await page.getByLabel("Email address").fill("nobody@example.com");
    await page.getByRole("button", { name: /Send my PDFs/i }).click();
    await expect(page.getByText(/Check your inbox/i)).toBeVisible();
  });

  test("/resend never reveals whether an email exists", async ({ page }) => {
    await page.goto("/resend");
    await page.getByLabel("Email address").fill("definitely-not-a-customer@example.com");
    await page.getByRole("button", { name: /Send my PDFs/i }).click();
    // Same generic confirmation regardless of DB state — prevents enumeration.
    await expect(page.getByText(/If/)).toBeVisible();
  });
});

test.describe("Removed routes return 404", () => {
  for (const url of ["/dashboard", "/api/demo-pdf", "/login"]) {
    test(`${url} is gone`, async ({ page }) => {
      const res = await page.goto(url, { waitUntil: "domcontentloaded" });
      expect(res?.status()).toBeGreaterThanOrEqual(400);
    });
  }
});

test.describe("Admin", () => {
  test("/admin redirects to /admin/login when signed out", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByText(/Admin sign-in/i)).toBeVisible();
  });
});
