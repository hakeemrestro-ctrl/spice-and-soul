import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePdf } from "@/components/invoice-pdf";

type InvoiceData = {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  courseTitle: string;
  priceCents: number;
  last4?: string;
  accessUrl: string;
};

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  // InvoicePdf renders a <Document> which satisfies ReactElement<DocumentProps>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(InvoicePdf, data) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
