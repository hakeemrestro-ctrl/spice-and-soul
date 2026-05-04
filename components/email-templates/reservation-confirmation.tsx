import {
  Body, Container, Head, Hr, Html, Preview, Section, Text,
} from "@react-email/components";

type Props = {
  guestName: string;
  partySize: number;
  preferredDate: string | null;
  notes: string | null;
};

export function ReservationConfirmationEmail({ guestName, partySize, preferredDate, notes }: Props) {
  const firstName = guestName.split(" ")[0];
  return (
    <Html lang="en">
      <Head />
      <Preview>Reservation request received — Hakeem&apos;s Restaurant</Preview>
      <Body style={{ backgroundColor: "#fafaf9", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", margin: "0", padding: "0" }}>
        <Container style={{ backgroundColor: "#ffffff", margin: "40px auto", maxWidth: "520px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <Section style={{ backgroundColor: "#3e2c19", padding: "24px 40px" }}>
            <Text style={{ color: "#f59e0b", fontSize: "20px", fontWeight: "700", margin: "0" }}>
              Hakeem&apos;s Restaurant
            </Text>
            <Text style={{ color: "#d4a96a", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", margin: "4px 0 0" }}>
              By Spice &amp; Soul Academy
            </Text>
          </Section>

          <Section style={{ padding: "36px 40px" }}>
            <Text style={{ fontSize: "22px", fontWeight: "700", color: "#1c1917", margin: "0 0 12px" }}>
              We got your request, {firstName}!
            </Text>
            <Text style={{ fontSize: "15px", color: "#57534e", lineHeight: "1.6", margin: "0 0 24px" }}>
              Thank you for your reservation request. Our team will confirm availability and reach out shortly.
            </Text>

            <Section style={{ backgroundColor: "#fef3c7", borderRadius: "8px", padding: "20px 24px", marginBottom: "24px" }}>
              <Text style={{ fontSize: "13px", color: "#92400e", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 12px", fontWeight: "600" }}>
                Your Request
              </Text>
              <Text style={{ fontSize: "14px", color: "#78350f", margin: "0 0 6px" }}>
                <strong>Party size:</strong> {partySize} {partySize === 1 ? "person" : "people"}
              </Text>
              {preferredDate && (
                <Text style={{ fontSize: "14px", color: "#78350f", margin: "0 0 6px" }}>
                  <strong>Preferred date:</strong> {new Date(preferredDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </Text>
              )}
              {notes && (
                <Text style={{ fontSize: "14px", color: "#78350f", margin: "0" }}>
                  <strong>Notes:</strong> {notes}
                </Text>
              )}
            </Section>

            <Text style={{ fontSize: "14px", color: "#78716c", lineHeight: "1.6", margin: "0" }}>
              Questions? Reply to this email or call us. We look forward to hosting you.
            </Text>
          </Section>

          <Hr style={{ borderColor: "#e7e5e4", margin: "0 40px" }} />
          <Section style={{ padding: "20px 40px" }}>
            <Text style={{ fontSize: "13px", color: "#a8a29e", margin: "0" }}>
              — The team at Hakeem&apos;s Restaurant, Indore
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

ReservationConfirmationEmail.PreviewProps = {
  guestName: "Priya Sharma",
  partySize: 4,
  preferredDate: "2026-06-15",
  notes: "Anniversary dinner, please arrange a quiet table.",
} satisfies Props;
