import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

const LOGO = "https://res.cloudinary.com/doajstql7/image/upload/q_auto/f_auto/v1777003162/f3d21215-ada9-4ea3-b86d-510a6885c8f5-removebg-preview_uat1ay.png";

// Dark theme palette — matches app globals
const C = {
  bg:       "#07090c",
  card:     "#0d1117",
  cardAlt:  "#111520",
  border:   "#1c2333",
  accent:   "#e87f24",
  accentDim:"#7a3a0e",
  text:     "#dce3ed",
  muted:    "#6b7789",
  success:  "#22c55e",
  successBg:"#0d2318",
  warning:  "#f59e0b",
  warningBg:"#1e1608",
  danger:   "#ef4444",
  dangerBg: "#1f0c0c",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.text,
    backgroundColor: C.bg,
    padding: 48,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
    paddingBottom: 22,
    borderBottom: `1.5px solid ${C.accent}`,
  },
  logoArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
  },
  brandName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: C.accent,
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 7.5,
    color: C.muted,
    marginTop: 2,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  invoiceLabel: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 9,
    color: C.muted,
    textAlign: "right",
    marginTop: 3,
  },
  // Parties
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  partyBlock: {
    width: "45%",
  },
  partyLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.accent,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  partyName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.text,
    marginBottom: 2,
  },
  partyLine: {
    fontSize: 9,
    color: C.muted,
    marginBottom: 2,
  },
  // Meta row
  metaRow: {
    flexDirection: "row",
    gap: 0,
    marginBottom: 26,
    backgroundColor: C.card,
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    overflow: "hidden",
  },
  metaItem: {
    flex: 1,
    padding: "10 14",
    borderRight: `1px solid ${C.border}`,
  },
  metaItemLast: {
    flex: 1,
    padding: "10 14",
  },
  metaLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.text,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.accent,
    borderRadius: 4,
    padding: "7 12",
    marginBottom: 1,
  },
  tableHeaderCell: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    padding: "10 12",
    borderBottom: `0.5px solid ${C.border}`,
  },
  tableRowAlt: {
    backgroundColor: C.cardAlt,
  },
  tableCell: {
    fontSize: 9.5,
    color: C.text,
  },
  colDesc:  { flex: 1 },
  colQty:   { width: 50, textAlign: "center" },
  colUnit:  { width: 80, textAlign: "right" },
  colTotal: { width: 80, textAlign: "right" },
  // Summary
  summaryBlock: {
    alignItems: "flex-end",
    marginTop: 16,
    paddingTop: 12,
    borderTop: `1px solid ${C.border}`,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
    width: 220,
  },
  summaryLabel: {
    fontSize: 9,
    color: C.muted,
    flex: 1,
    textAlign: "right",
    paddingRight: 12,
  },
  summaryValue: {
    fontSize: 9,
    color: C.text,
    width: 80,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    backgroundColor: C.accent,
    borderRadius: 4,
    padding: "8 12",
    marginTop: 6,
    width: 220,
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    flex: 1,
    textAlign: "right",
    paddingRight: 12,
  },
  totalValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    width: 80,
    textAlign: "right",
  },
  // Status badges
  statusPaid: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.success,
    backgroundColor: C.successBg,
    padding: "2 7",
    borderRadius: 99,
  },
  statusPending: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.warning,
    backgroundColor: C.warningBg,
    padding: "2 7",
    borderRadius: 99,
  },
  statusOverdue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.danger,
    backgroundColor: C.dangerBg,
    padding: "2 7",
    borderRadius: 99,
  },
  // Note box
  noteBox: {
    marginTop: 24,
    padding: "10 14",
    backgroundColor: C.card,
    borderLeft: `3px solid ${C.accent}`,
    borderRadius: 2,
  },
  noteLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.accent,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 9,
    color: C.muted,
    lineHeight: 1.6,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 36,
    left: 48,
    right: 48,
    borderTop: `0.5px solid ${C.border}`,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLogo: {
    width: 16,
    height: 16,
  },
  footerText: {
    fontSize: 7.5,
    color: C.muted,
  },
});

export interface InvoicePDFData {
  id: string;
  amount: number;
  status: string;
  description: string | null;
  dueDate: string;
  createdAt: string;
  paidAt: string | null;
  client: {
    name: string;
    business: string;
    email: string;
    phone?: string | null;
    website?: string | null;
  };
}

function statusStyle(s: string) {
  if (s === "paid") return styles.statusPaid;
  if (s === "overdue") return styles.statusOverdue;
  return styles.statusPending;
}

// Parse description into line items: "Service A + Service B" or plain text
function parseLineItems(description: string | null, total: number) {
  if (!description) {
    return [{ desc: "Professional Services", qty: 1, unit: total, total }];
  }
  const parts = description.split("+").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return [{ desc: description, qty: 1, unit: total, total }];
  }
  // Equal split for multi-item (best guess without per-item prices stored on invoice)
  const each = Math.round((total / parts.length) * 100) / 100;
  return parts.map((p, i) => ({
    desc: p,
    qty: 1,
    unit: i === parts.length - 1 ? total - each * (parts.length - 1) : each,
    total: i === parts.length - 1 ? total - each * (parts.length - 1) : each,
  }));
}

export function InvoicePDF({ invoice }: { invoice: InvoicePDFData }) {
  const shortId = invoice.id.slice(-8).toUpperCase();
  const lineItems = parseLineItems(invoice.description, invoice.amount);
  const subtotal = lineItems.reduce((s, l) => s + l.total, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoArea}>
            <Image src={LOGO} style={styles.logo} />
            <View>
              <Text style={styles.brandName}>Kootenay Signal</Text>
              <Text style={styles.brandTagline}>Control Your Signal</Text>
            </View>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNumber}># KS-{shortId}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>From</Text>
            <Text style={styles.partyName}>Kootenay Signal</Text>
            <Text style={styles.partyLine}>jaryd@kootenaysignal.com</Text>
            <Text style={styles.partyLine}>kootenaysignal.com</Text>
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Bill To</Text>
            <Text style={styles.partyName}>{invoice.client.name}</Text>
            <Text style={styles.partyLine}>{invoice.client.business}</Text>
            <Text style={styles.partyLine}>{invoice.client.email}</Text>
            {invoice.client.phone && <Text style={styles.partyLine}>{invoice.client.phone}</Text>}
          </View>
        </View>

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Invoice #</Text>
            <Text style={styles.metaValue}>KS-{shortId}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Issue Date</Text>
            <Text style={styles.metaValue}>
              {new Date(invoice.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>
              {new Date(invoice.dueDate).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
            </Text>
          </View>
          <View style={styles.metaItemLast}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={statusStyle(invoice.status)}>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unit Price</Text>
          <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
        </View>
        {lineItems.map((item, i) => (
          <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.tableCell, styles.colDesc]}>{item.desc}</Text>
            <Text style={[styles.tableCell, styles.colQty]}>{item.qty}</Text>
            <Text style={[styles.tableCell, styles.colUnit]}>${item.unit.toFixed(2)}</Text>
            <Text style={[styles.tableCell, styles.colTotal]}>${item.total.toFixed(2)}</Text>
          </View>
        ))}

        {/* Summary */}
        <View style={styles.summaryBlock}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (0%)</Text>
            <Text style={styles.summaryValue}>$0.00</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Due</Text>
            <Text style={styles.totalValue}>${invoice.amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Note */}
        {invoice.status !== "paid" && (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Payment</Text>
            <Text style={styles.noteText}>
              Please remit payment by {new Date(invoice.dueDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}.{"\n"}
              For questions, contact jaryd@kootenaysignal.com
            </Text>
          </View>
        )}
        {invoice.status === "paid" && invoice.paidAt && (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Payment Received</Text>
            <Text style={styles.noteText}>
              Thank you! Payment received on{" "}
              {new Date(invoice.paidAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}.
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Image src={LOGO} style={styles.footerLogo} />
            <Text style={styles.footerText}>Kootenay Signal · kootenaysignal.com</Text>
          </View>
          <Text style={styles.footerText}>Invoice KS-{shortId}</Text>
        </View>
      </Page>
    </Document>
  );
}
