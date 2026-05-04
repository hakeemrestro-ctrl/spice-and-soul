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
  courseTitle: string;
  recipeCount: number;
  resendUrl: string;
  childCourseTitles?: string[];
  giftFromName?: string;
  giftMessage?: string | null;
};

export function PurchaseConfirmationEmail({
  customerName,
  courseTitle,
  recipeCount,
  resendUrl,
  childCourseTitles,
  giftFromName,
  giftMessage,
}: Props) {
  const firstName = customerName.split(" ")[0];
  const isBundle = !!childCourseTitles && childCourseTitles.length > 0;
  const isGift = !!giftFromName;

  return (
    <Html lang="en">
      <Head />
      <Preview>Your course is ready — {courseTitle}</Preview>
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
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <Section
            style={{
              backgroundColor: "#f59e0b",
              padding: "24px 40px",
            }}
          >
            <Text
              style={{
                color: "#ffffff",
                fontSize: "22px",
                fontWeight: "700",
                margin: "0",
                letterSpacing: "-0.3px",
              }}
            >
              Spice &amp; Soul Academy
            </Text>
          </Section>

          <Section style={{ padding: "40px 40px 0" }}>
            <Text
              style={{
                fontSize: "24px",
                fontWeight: "700",
                color: "#1c1917",
                margin: "0 0 16px",
              }}
            >
              {isGift ? `A gift for you, ${firstName}` : `You\u2019re in, ${firstName}!`}
            </Text>

            <Text
              style={{
                fontSize: "15px",
                color: "#57534e",
                lineHeight: "1.6",
                margin: "0 0 24px",
              }}
            >
              {isGift ? (
                <>
                  <strong>{giftFromName}</strong> has gifted you{" "}
                  <strong>{courseTitle}</strong>.
                  {isBundle
                    ? " All recipe books are attached below."
                    : " Your recipe book is attached below."}
                </>
              ) : (
                <>
                  Your purchase of <strong>{courseTitle}</strong> is confirmed.
                  {isBundle
                    ? " All recipe books are attached below."
                    : " Your recipe book is attached below."}
                </>
              )}
            </Text>

            {isGift && giftMessage ? (
              <Section
                style={{
                  borderLeft: "3px solid #f59e0b",
                  padding: "8px 16px",
                  margin: "0 0 24px",
                  backgroundColor: "#fefce8",
                }}
              >
                <Text
                  style={{
                    fontSize: "14px",
                    color: "#78350f",
                    fontStyle: "italic",
                    margin: "0",
                    lineHeight: "1.5",
                  }}
                >
                  &ldquo;{giftMessage}&rdquo;
                </Text>
              </Section>
            ) : null}

            <Section
              style={{
                backgroundColor: "#fef3c7",
                borderRadius: "6px",
                padding: "20px 24px",
                marginBottom: "24px",
              }}
            >
              <Text
                style={{
                  fontSize: "15px",
                  color: "#78350f",
                  margin: "0 0 8px",
                  fontWeight: "600",
                }}
              >
                {courseTitle}
              </Text>
              <Text
                style={{
                  fontSize: "14px",
                  color: "#92400e",
                  margin: "0 0 4px",
                }}
              >
                {recipeCount} recipes included
              </Text>
              <Text
                style={{
                  fontSize: "14px",
                  color: "#92400e",
                  margin: "0",
                }}
              >
                Lifetime access
              </Text>
              {isBundle && (
                <Text
                  style={{
                    fontSize: "13px",
                    color: "#78350f",
                    margin: "12px 0 0",
                    lineHeight: "1.5",
                  }}
                >
                  Includes: {childCourseTitles!.join(" · ")}
                </Text>
              )}
            </Section>

            <Text
              style={{
                fontSize: "14px",
                color: "#78716c",
                margin: "0 0 24px",
                fontStyle: "italic",
              }}
            >
              {isGift
                ? "Recipe PDFs are attached. Lost the email? Re-send anytime — no login needed."
                : "Recipe PDFs and invoice are attached. Lost the email? Re-send anytime — no login needed."}
            </Text>

            <Link
              href={resendUrl}
              style={{
                display: "inline-block",
                backgroundColor: "#f59e0b",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: "600",
                textDecoration: "none",
                padding: "14px 32px",
                borderRadius: "6px",
                marginBottom: "32px",
              }}
            >
              Re-send my PDFs →
            </Link>
          </Section>

          <Hr style={{ borderColor: "#e7e5e4", margin: "0 40px" }} />

          <Section style={{ padding: "24px 40px" }}>
            <Text
              style={{
                fontSize: "14px",
                color: "#a8a29e",
                margin: "0",
              }}
            >
              — The Spice &amp; Soul Team
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
