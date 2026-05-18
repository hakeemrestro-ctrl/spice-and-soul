import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type Props = {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  date: string;
  courseTitle: string;
  priceCents: number;
  last4?: string;
  resendUrl: string;
};

/**
 * Minimal formal receipt email. Companion to PurchaseConfirmationEmail.
 *
 * Sent IN ADDITION TO the welcome email so the customer has a separate
 * email-of-record for accounting / expense filing. Body is intentionally
 * short — full line-item PDF is the attachment.
 */
export function InvoiceEmail({
  customerName,
  customerEmail,
  invoiceNumber,
  date,
  courseTitle,
  priceCents,
  last4,
  resendUrl,
}: Props) {
  const amount = `INR ${(priceCents / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Invoice {invoiceNumber} — {courseTitle}
      </Preview>
      <Body
        style={{
          backgroundColor: "#fafaf9",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: "0",
          padding: "0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "40px auto",
            maxWidth: "560px",
            border: "1px solid #e7e5e4",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <Section
            style={{
              backgroundColor: "#1c1917",
              padding: "24px 40px",
            }}
          >
            <Text
              style={{
                color: "#fafaf9",
                fontSize: "14px",
                letterSpacing: "0.08em",
                margin: "0",
                textTransform: "uppercase",
              }}
            >
              Spice &amp; Soul Academy
            </Text>
            <Text
              style={{
                color: "#fbbf24",
                fontSize: "22px",
                fontWeight: "600",
                margin: "8px 0 0",
              }}
            >
              Invoice {invoiceNumber}
            </Text>
          </Section>

          <Section style={{ padding: "32px 40px 8px" }}>
            <Text
              style={{
                color: "#1c1917",
                fontSize: "15px",
                lineHeight: "1.6",
                margin: "0 0 16px",
              }}
            >
              Hi {customerName.split(" ")[0] || "there"},
            </Text>
            <Text
              style={{
                color: "#44403c",
                fontSize: "14px",
                lineHeight: "1.6",
                margin: "0 0 20px",
              }}
            >
              Receipt for your purchase is attached as a PDF. Keep it for
              your records — your welcome email with the course materials
              was sent separately.
            </Text>
          </Section>

          <Section style={{ padding: "0 40px" }}>
            <table
              cellPadding={0}
              cellSpacing={0}
              style={{ borderCollapse: "collapse", width: "100%" }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      color: "#78716c",
                      fontSize: "12px",
                      letterSpacing: "0.05em",
                      padding: "6px 0",
                      textTransform: "uppercase",
                      width: "120px",
                    }}
                  >
                    Invoice
                  </td>
                  <td
                    style={{
                      color: "#1c1917",
                      fontSize: "14px",
                      padding: "6px 0",
                    }}
                  >
                    {invoiceNumber}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      color: "#78716c",
                      fontSize: "12px",
                      letterSpacing: "0.05em",
                      padding: "6px 0",
                      textTransform: "uppercase",
                    }}
                  >
                    Date
                  </td>
                  <td
                    style={{
                      color: "#1c1917",
                      fontSize: "14px",
                      padding: "6px 0",
                    }}
                  >
                    {date}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      color: "#78716c",
                      fontSize: "12px",
                      letterSpacing: "0.05em",
                      padding: "6px 0",
                      textTransform: "uppercase",
                    }}
                  >
                    Billed to
                  </td>
                  <td
                    style={{
                      color: "#1c1917",
                      fontSize: "14px",
                      padding: "6px 0",
                    }}
                  >
                    {customerName}
                    <br />
                    <span style={{ color: "#78716c" }}>{customerEmail}</span>
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      color: "#78716c",
                      fontSize: "12px",
                      letterSpacing: "0.05em",
                      padding: "6px 0",
                      textTransform: "uppercase",
                    }}
                  >
                    Item
                  </td>
                  <td
                    style={{
                      color: "#1c1917",
                      fontSize: "14px",
                      padding: "6px 0",
                    }}
                  >
                    {courseTitle}
                  </td>
                </tr>
                {last4 ? (
                  <tr>
                    <td
                      style={{
                        color: "#78716c",
                        fontSize: "12px",
                        letterSpacing: "0.05em",
                        padding: "6px 0",
                        textTransform: "uppercase",
                      }}
                    >
                      Payment
                    </td>
                    <td
                      style={{
                        color: "#1c1917",
                        fontSize: "14px",
                        padding: "6px 0",
                      }}
                    >
                      {last4}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Section>

          <Hr
            style={{
              borderColor: "#e7e5e4",
              margin: "20px 40px",
            }}
          />

          <Section style={{ padding: "0 40px 4px" }}>
            <table
              cellPadding={0}
              cellSpacing={0}
              style={{ borderCollapse: "collapse", width: "100%" }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      color: "#1c1917",
                      fontSize: "15px",
                      fontWeight: "600",
                      padding: "8px 0",
                    }}
                  >
                    Total paid
                  </td>
                  <td
                    style={{
                      color: "#1c1917",
                      fontSize: "18px",
                      fontWeight: "700",
                      padding: "8px 0",
                      textAlign: "right",
                    }}
                  >
                    {amount}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ padding: "20px 40px 32px" }}>
            <Text
              style={{
                color: "#78716c",
                fontSize: "12px",
                lineHeight: "1.6",
                margin: "0",
              }}
            >
              Need another copy?{" "}
              <Link
                href={resendUrl}
                style={{ color: "#a16207", textDecoration: "underline" }}
              >
                Re-send the invoice and course PDFs
              </Link>{" "}
              anytime — no login required.
            </Text>
            <Text
              style={{
                color: "#78716c",
                fontSize: "12px",
                lineHeight: "1.6",
                margin: "12px 0 0",
              }}
            >
              Questions about this charge? Reply to this email or write to
              hakeemrestro@gmail.com.
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: "#fafaf9",
              borderTop: "1px solid #e7e5e4",
              padding: "16px 40px",
            }}
          >
            <Text
              style={{
                color: "#a8a29e",
                fontSize: "11px",
                lineHeight: "1.5",
                margin: "0",
                textAlign: "center",
              }}
            >
              Spice &amp; Soul Academy by Hakeem Restaurant, Bhopal
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
