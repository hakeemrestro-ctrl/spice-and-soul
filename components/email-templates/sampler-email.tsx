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
  name?: string;
  coursesUrl: string;
};

export function SamplerEmail({ name, coursesUrl }: Props) {
  const greeting = name ? `Hi ${name.split(" ")[0]},` : "Hi there,";
  return (
    <Html lang="en">
      <Head />
      <Preview>Your free Indian cooking sampler is attached — 3 recipes from Hakeem kitchen</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={logo}>
              Spice <span style={{ color: "#f29b1f" }}>&amp;</span> Soul
            </Heading>
            <Text style={subLogo}>ACADEMY · BY HAKEEM&apos;S</Text>
          </Section>

          <Section style={content}>
            <Heading as="h1" style={h1}>Your free recipe sampler is here</Heading>
            <Text style={para}>{greeting}</Text>
            <Text style={para}>
              We&apos;ve attached your <strong>3-recipe sampler PDF</strong> — a small taste of what&apos;s
              inside our full courses. These are real recipes from Hakeem kitchen in Bhopal,
              where three generations of chefs have refined every spice ratio and technique.
            </Text>

            <Text style={para}>
              <strong>What you&apos;ve got:</strong>
            </Text>
            <Text style={bullet}>· A fragrant dal recipe to start</Text>
            <Text style={bullet}>· A classic chicken dish with technique notes</Text>
            <Text style={bullet}>· A street-style snack you can make today</Text>

            <Hr style={divider} />

            <Text style={para}>
              When you&apos;re ready for the full collection — 114 recipes across 5 courses — browse
              the complete lineup below.
            </Text>

            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Button href={coursesUrl} style={ctaButton}>
                Browse all courses →
              </Button>
            </Section>

            <Hr style={divider} />
            <Text style={footer}>
              Spice &amp; Soul Academy · by Hakeem, Bhopal
              <br />
              You received this because you requested the free sampler.{" "}
              No future marketing unless you purchase a course.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

SamplerEmail.PreviewProps = {
  name: "Priya",
  coursesUrl: "https://hakeemrestro.shop/courses",
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
const bullet: React.CSSProperties = {
  color: "#5a3e2a",
  fontSize: 14,
  lineHeight: "1.6",
  margin: "0 0 6px 12px",
};
const divider: React.CSSProperties = {
  borderColor: "#ead9c4",
  margin: "28px 0",
};
const ctaButton: React.CSSProperties = {
  backgroundColor: "#3e2c19",
  borderRadius: 10,
  color: "#fdf6ee",
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
