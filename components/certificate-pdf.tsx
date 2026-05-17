import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

type Props = {
  customerName: string;
  courseTitle: string;
  issuedDate: string;
  certificateId: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontFamily: "Helvetica",
    backgroundColor: "#fdf6ee",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  border: {
    borderWidth: 3,
    borderColor: "#d97706",
    padding: 40,
    width: "100%",
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 3,
    color: "#d97706",
    textTransform: "uppercase",
    marginBottom: 16,
  },
  brand: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#3e2c19",
    marginBottom: 4,
  },
  brandSub: {
    fontSize: 10,
    letterSpacing: 2,
    color: "#9a7a5a",
    textTransform: "uppercase",
    marginBottom: 32,
  },
  certTitle: {
    fontSize: 14,
    color: "#5a3e2a",
    marginBottom: 24,
  },
  recipientLabel: {
    fontSize: 11,
    color: "#9a7a5a",
    marginBottom: 6,
  },
  recipientName: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: "#3e2c19",
    marginBottom: 24,
  },
  courseLabel: {
    fontSize: 11,
    color: "#9a7a5a",
    marginBottom: 6,
  },
  courseTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#d97706",
    marginBottom: 32,
    textAlign: "center",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#ddc9af",
    width: "60%",
    marginBottom: 24,
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
  },
  metaItem: {
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 8,
    color: "#9a7a5a",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10,
    color: "#3e2c19",
    fontFamily: "Helvetica-Bold",
  },
  signature: {
    marginTop: 32,
    alignItems: "center",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#3e2c19",
    width: 180,
    marginBottom: 6,
  },
  signerName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#3e2c19",
  },
  signerTitle: {
    fontSize: 9,
    color: "#9a7a5a",
  },
});

export function CertificatePdf({ customerName, courseTitle, issuedDate, certificateId }: Props) {
  return (
    <Document title={`Certificate — ${courseTitle}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border}>
          <Text style={styles.eyebrow}>Certificate of Enrollment</Text>

          <Text style={styles.brand}>Spice &amp; Soul Academy</Text>
          <Text style={styles.brandSub}>by Hakeem · Bhopal</Text>

          <Text style={styles.certTitle}>This certifies that</Text>

          <Text style={styles.recipientName}>{customerName}</Text>

          <Text style={styles.courseLabel}>is enrolled in</Text>
          <Text style={styles.courseTitle}>{courseTitle}</Text>

          <View style={styles.divider} />

          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Issued on</Text>
              <Text style={styles.metaValue}>{issuedDate}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Certificate ID</Text>
              <Text style={styles.metaValue}>{certificateId.slice(0, 8).toUpperCase()}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Issuer</Text>
              <Text style={styles.metaValue}>Spice &amp; Soul Academy</Text>
            </View>
          </View>

          <View style={styles.signature}>
            <View style={styles.signatureLine} />
            <Text style={styles.signerName}>Chef Hakeem</Text>
            <Text style={styles.signerTitle}>Head Chef &amp; Founder, Hakeem Restaurant</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
