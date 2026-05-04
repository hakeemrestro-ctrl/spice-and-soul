import {
  Body, Container, Head, Hr, Html, Preview, Section, Text,
} from "@react-email/components";

export type DigestData = {
  date: string;
  ordersCount: number;
  revenueUsd: string;
  newSubscribers: number;
  pendingReviews: number;
  newReservations: number;
};

export function DailyDigestEmail({
  date,
  ordersCount,
  revenueUsd,
  newSubscribers,
  pendingReviews,
  newReservations,
}: DigestData) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Daily digest — {date}</Preview>
      <Body style={{ backgroundColor: "#fafaf9", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", margin: "0", padding: "0" }}>
        <Container style={{ backgroundColor: "#ffffff", margin: "40px auto", maxWidth: "480px", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <Section style={{ backgroundColor: "#3e2c19", padding: "20px 32px" }}>
            <Text style={{ color: "#f59e0b", fontSize: "14px", fontWeight: "700", margin: "0" }}>
              Spice &amp; Soul · Daily Digest
            </Text>
            <Text style={{ color: "#9a7a5a", fontSize: "12px", margin: "4px 0 0" }}>{date}</Text>
          </Section>

          <Section style={{ padding: "28px 32px 8px" }}>
            <Text style={{ fontSize: "13px", color: "#9a7a5a", textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 16px", fontWeight: "600" }}>
              Yesterday
            </Text>

            <StatRow label="Orders" value={ordersCount.toString()} />
            <StatRow label="Revenue" value={revenueUsd} highlight />
            <StatRow label="New subscribers" value={newSubscribers.toString()} />
            <StatRow label="New reservations" value={newReservations.toString()} />
          </Section>

          <Hr style={{ borderColor: "#e7e5e4", margin: "0 32px" }} />

          <Section style={{ padding: "20px 32px 28px" }}>
            <Text style={{ fontSize: "13px", color: "#9a7a5a", textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 16px", fontWeight: "600" }}>
              Action needed
            </Text>
            {pendingReviews > 0 ? (
              <Text style={{ fontSize: "15px", color: "#d97706", margin: "0" }}>
                ⭐ {pendingReviews} review{pendingReviews > 1 ? "s" : ""} awaiting moderation
              </Text>
            ) : (
              <Text style={{ fontSize: "14px", color: "#a8a29e", margin: "0" }}>
                No pending reviews — inbox clear.
              </Text>
            )}
          </Section>

          <Section style={{ backgroundColor: "#fef3c7", padding: "16px 32px" }}>
            <Text style={{ fontSize: "12px", color: "#92400e", margin: "0" }}>
              Spice &amp; Soul Academy admin digest · automated daily at 8am ET
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Section style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
      <Text style={{ fontSize: "14px", color: "#78716c", margin: "0", display: "inline" }}>{label}</Text>
      <Text style={{ fontSize: "14px", color: highlight ? "#d97706" : "#1c1917", fontWeight: highlight ? "700" : "600", margin: "0", display: "inline" }}>
        {value}
      </Text>
    </Section>
  );
}

DailyDigestEmail.PreviewProps = {
  date: "Thursday, 2 January 2026",
  ordersCount: 7,
  revenueUsd: "$1,249.00",
  newSubscribers: 23,
  pendingReviews: 3,
  newReservations: 2,
} satisfies DigestData;
