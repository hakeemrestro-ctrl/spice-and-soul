import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 11, color: "#1a1a1a" },
  header: { marginBottom: 32 },
  logo: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#d97706" },
  subtitle: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  invoiceNumber: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  section: { marginBottom: 20 },
  label: { fontSize: 9, color: "#6b7280", textTransform: "uppercase", marginBottom: 3 },
  value: { fontSize: 11 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginVertical: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rowLabel: { color: "#374151" },
  rowValue: { fontFamily: "Helvetica-Bold" },
  total: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#d97706" },
  paid: {
    backgroundColor: "#dcfce7",
    color: "#16a34a",
    padding: "4 10",
    fontSize: 10,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  footer: { marginTop: 40, fontSize: 10, color: "#9ca3af", textAlign: "center" },
});

type Props = {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  courseTitle: string;
  priceCents: number;
  last4?: string;
  accessUrl: string;
};

export function InvoicePdf({
  invoiceNumber,
  date,
  customerName,
  customerEmail,
  courseTitle,
  priceCents,
  last4,
  accessUrl,
}: Props) {
  const priceFormatted = `$${(priceCents / 100).toFixed(2)}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>Spice & Soul Academy</Text>
          <Text style={styles.subtitle}>spiceandsoul.com</Text>
        </View>

        <Text style={styles.invoiceNumber}>Invoice #{invoiceNumber}</Text>
        <Text style={{ color: "#6b7280", marginBottom: 24 }}>Date: {date}</Text>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Bill To</Text>
          <Text style={styles.value}>{customerName}</Text>
          <Text style={styles.value}>{customerEmail}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{courseTitle}</Text>
            <Text style={styles.rowValue}>{priceFormatted}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tax</Text>
            <Text style={styles.rowValue}>$0.00</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={[styles.row, { marginBottom: 20 }]}>
          <Text style={[styles.rowLabel, { fontSize: 14 }]}>Total</Text>
          <Text style={styles.total}>{priceFormatted}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Payment</Text>
          {last4 && <Text style={styles.value}>Card ending in {last4}</Text>}
          <View style={{ marginTop: 6 }}>
            <Text style={styles.paid}>PAID</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>
          Re-send your PDFs anytime at:
        </Text>
        <Text style={{ fontSize: 10, color: "#d97706" }}>{accessUrl}</Text>

        <Text style={styles.footer}>
          Thank you for your purchase! · Spice & Soul Academy
        </Text>
      </Page>
    </Document>
  );
}
