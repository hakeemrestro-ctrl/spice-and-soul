import { describe, it, expect, vi } from "vitest";
import { generateInvoicePdf } from "@/lib/invoice";

vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from("mock-pdf")),
  Document: ({ children }: { children: unknown }) => children,
  Page: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
  View: ({ children }: { children: unknown }) => children,
  StyleSheet: { create: (s: unknown) => s },
}));

describe("generateInvoicePdf", () => {
  it("returns a Buffer", async () => {
    const result = await generateInvoicePdf({
      invoiceNumber: "INV-2026-0001",
      date: "25 April 2026",
      customerName: "Aisha Khan",
      customerEmail: "aisha@example.com",
      courseTitle: "North Indian Classics",
      priceCents: 25000,
      last4: "4242",
      accessUrl: "https://spiceandsoul.com/resend",
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("calls renderToBuffer with a React element", async () => {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    await generateInvoicePdf({
      invoiceNumber: "INV-2026-0002",
      date: "25 April 2026",
      customerName: "Test User",
      customerEmail: "test@example.com",
      courseTitle: "South Indian Mastery",
      priceCents: 59900,
      accessUrl: "https://spiceandsoul.com/resend",
    });
    expect(renderToBuffer).toHaveBeenCalled();
  });
});
