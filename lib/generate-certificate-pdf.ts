import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { CertificatePdf } from "@/components/certificate-pdf";
import { registerPdfFonts } from "@/lib/pdf-fonts";

type CertificateInput = {
  customerName: string;
  courseTitle: string;
  certificateId: string;
};

export async function generateCertificatePdf(input: CertificateInput): Promise<Buffer> {
  registerPdfFonts();
  const { customerName, courseTitle, certificateId } = input;

  const issuedDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(CertificatePdf, { customerName, courseTitle, issuedDate, certificateId }) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
