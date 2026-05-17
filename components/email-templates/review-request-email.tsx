import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type Props = {
  customerName: string;
  courseTitle: string;
  reviewUrl: string;
};

export function ReviewRequestEmail({ customerName, courseTitle, reviewUrl }: Props) {
  const first = customerName.split(" ")[0];
  return (
    <Html lang="en">
      <Head />
      <Preview>How did {courseTitle} go? We&apos;d love to hear from you.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>
              Spice <span style={{ color: "#f29b1f" }}>&amp;</span> Soul
            </Heading>
            <Text style={subLogo}>ACADEMY · BY HAKEEM&apos;S</Text>
          </Section>

          <Section style={content}>
            <Heading as="h1" style={h1}>How did it go, {first}?</Heading>
            <Text style={para}>
              It&apos;s been a week since you picked up <strong>{courseTitle}</strong>. We hope
              you&apos;ve had a chance to fire up the stove!
            </Text>
            <Text style={para}>
              Would you share a quick review? It takes less than a minute, and it helps other
              home cooks decide if this course is right for them.
            </Text>

            <Section style={{ textAlign: "center", margin: "28px 0" }}>
              <Button href={reviewUrl} style={ctaButton}>
                Leave a review →
              </Button>
            </Section>

            <Hr style={divider} />
            <Text style={footer}>
              Spice &amp; Soul Academy · by Hakeem, Bhopal
              <br />
              You&apos;re receiving this because you purchased a course. This is a one-time
              review request — no further emails.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

ReviewRequestEmail.PreviewProps = {
  customerName: "Priya Singh",
  courseTitle: "North Indian Classics",
  reviewUrl: "https://hakeemrestro.shop/review/some-token",
} satisfies Props;

const body: React.CSSProperties = {
  backgroundColor: "#fdf6ee",
  fontFamily: "Geist, 'Helvetica Neue', Arial, sans-serif",
};
const container: React.CSSProperties = {
  maxWidth: 600,
  margin: "0 auto",
  backgroundColor: "#fff",
  borderRadius: 16,
  overflow: "hidden",
};
const header: React.CSSProperties = {
  backgroundColor: "#3e2c19",
  padding: "32px 40px 24px",
  textAlign: "center",
};
const logo: React.CSSProperties = {
  color: "#fdf6ee",
  fontSize: 28,
  fontWeight: 400,
  margin: 0,
};
const subLogo: React.CSSProperties = {
  color: "#c9a97a",
  fontSize: 11,
  letterSpacing: "0.24em",
  margin: "4px 0 0",
};
const content: React.CSSProperties = { padding: "36px 40px" };
const h1: React.CSSProperties = {
  color: "#3e2c19",
  fontSize: 26,
  fontWeight: 600,
  margin: "0 0 20px",
};
const para: React.CSSProperties = {
  color: "#5a3e2a",
  fontSize: 15,
  lineHeight: "1.65",
  margin: "0 0 14px",
};
const divider: React.CSSProperties = {
  borderColor: "#ead9c4",
  margin: "28px 0",
};
const ctaButton: React.CSSProperties = {
  backgroundColor: "#f29b1f",
  borderRadius: 10,
  color: "#3e2c19",
  display: "inline-block",
  fontSize: 14,
  fontWeight: 600,
  padding: "13px 28px",
  textDecoration: "none",
};
const footer: React.CSSProperties = {
  color: "#9a7a5a",
  fontSize: 12,
  lineHeight: "1.6",
  textAlign: "center",
};
