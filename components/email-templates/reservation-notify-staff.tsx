import {
  Body, Container, Head, Html, Preview, Section, Text,
} from "@react-email/components";

type Props = {
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  partySize: number;
  preferredDate: string | null;
  notes: string | null;
};

export function ReservationNotifyStaffEmail({
  guestName, guestEmail, guestPhone, partySize, preferredDate, notes,
}: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`New reservation request from ${guestName} — ${partySize} people`}</Preview>
      <Body style={{ backgroundColor: "#fafaf9", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", margin: "0", padding: "0" }}>
        <Container style={{ backgroundColor: "#ffffff", margin: "40px auto", maxWidth: "480px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <Section style={{ backgroundColor: "#d97706", padding: "16px 32px" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: "15px", margin: "0" }}>
              New Reservation Request
            </Text>
          </Section>
          <Section style={{ padding: "28px 32px" }}>
            <Text style={{ fontSize: "14px", color: "#3e2c19", margin: "0 0 8px" }}><strong>Guest:</strong> {guestName}</Text>
            <Text style={{ fontSize: "14px", color: "#3e2c19", margin: "0 0 8px" }}><strong>Email:</strong> {guestEmail}</Text>
            {guestPhone && (
              <Text style={{ fontSize: "14px", color: "#3e2c19", margin: "0 0 8px" }}><strong>Phone:</strong> {guestPhone}</Text>
            )}
            <Text style={{ fontSize: "14px", color: "#3e2c19", margin: "0 0 8px" }}><strong>Party size:</strong> {String(partySize)}</Text>
            {preferredDate && (
              <Text style={{ fontSize: "14px", color: "#3e2c19", margin: "0 0 8px" }}>
                <strong>Preferred date:</strong> {new Date(preferredDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </Text>
            )}
            {notes && (
              <Text style={{ fontSize: "14px", color: "#3e2c19", margin: "0" }}><strong>Notes:</strong> {notes}</Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
