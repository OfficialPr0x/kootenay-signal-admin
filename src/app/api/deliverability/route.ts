import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { resend } from "@/lib/email";

// GET /api/deliverability - Overall deliverability health
export async function GET() {
  // Get domains from Resend
  let domainHealth: {
    domain: string;
    spfStatus: string;
    dkimStatus: string;
    dmarcStatus: string;
    overallHealth: string;
    issues: string[];
  }[] = [];

  try {
    const { data: domainList } = await resend.domains.list();
    if (domainList?.data) {
      // Fetch full details (including records) for each domain
      const detailResults = await Promise.all(
        domainList.data.map((d: { id: string }) => resend.domains.get(d.id))
      );

      domainHealth = detailResults.map((res) => {
        const d = res.data as { name: string; status: string; records?: { record: string; type: string; status: string }[] } | null;
        if (!d) return null;

        const records = d.records || [];
        // Match by the "record" field, not "type" — Resend uses record: "SPF", record: "DKIM"
        const spf = records.find((r) => r.record === "SPF" && r.type === "TXT");
        const dkim = records.find((r) => r.record === "DKIM");

        const issues: string[] = [];
        const spfStatus = spf?.status === "verified" ? "pass" : "fail";
        const dkimStatus = dkim?.status === "verified" ? "pass" : "fail";
        // Resend doesn't manage DMARC — check if domain is fully verified instead
        const dmarcStatus = d.status === "verified" ? "pass" : "unknown";

        if (spfStatus === "fail") issues.push("SPF record not verified");
        if (dkimStatus === "fail") issues.push("DKIM record not verified");
        if (d.status !== "verified") issues.push("Domain not fully verified");

        const overallHealth = issues.length === 0 ? "healthy" : issues.length === 1 ? "warning" : "critical";

        return {
          domain: d.name,
          spfStatus,
          dkimStatus,
          dmarcStatus,
          overallHealth,
          issues,
        };
      }).filter(Boolean) as typeof domainHealth;
    }
  } catch {
    // If Resend API fails, return empty domain health
  }

  // Get mailbox health data
  const { data: mailboxRows } = await supabase
    .from("EmailAccount")
    .select("*, MailboxHealthSnapshot(*)");

  const mailboxData = (mailboxRows || []).map((mb: Record<string, unknown>) => {
    const snapshots = (mb.MailboxHealthSnapshot as Array<Record<string, unknown>> || []);
    const health = snapshots[0];
    return {
      id: mb.id as string,
      email: mb.email as string,
      trustScore: (mb.trustScore as number) || 0,
      dailySendLimit: mb.dailySendLimit as number,
      currentVolume: mb.currentVolume as number,
      warmupStatus: mb.warmupStatus as string,
      bounceRate: (health?.bounceRate as number) || 0,
      replyRate: (health?.replyRate as number) || 0,
      complaintRate: (health?.complaintRate as number) || 0,
    };
  });

  // Generate risk alerts
  const riskAlerts: {
    type: string;
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    mailbox?: string;
    domain?: string;
  }[] = [];

  for (const mb of mailboxData) {
    if (mb.bounceRate > 10) {
      riskAlerts.push({
        type: "bounce_rate",
        severity: "critical",
        title: "High Bounce Rate",
        description: `Bounce rate at ${mb.bounceRate.toFixed(1)}% — exceeds 10% threshold. Pause sending and clean your list.`,
        mailbox: mb.email,
      });
    } else if (mb.bounceRate > 5) {
      riskAlerts.push({
        type: "bounce_rate",
        severity: "warning",
        title: "Elevated Bounce Rate",
        description: `Bounce rate at ${mb.bounceRate.toFixed(1)}% — approaching danger zone.`,
        mailbox: mb.email,
      });
    }

    if (mb.complaintRate > 0.1) {
      riskAlerts.push({
        type: "complaint_rate",
        severity: "critical",
        title: "Spam Complaints Detected",
        description: `Complaint rate at ${mb.complaintRate.toFixed(2)}% — exceeds 0.1% threshold.`,
        mailbox: mb.email,
      });
    }

    if (mb.trustScore > 0 && mb.trustScore < 50) {
      riskAlerts.push({
        type: "trust_score",
        severity: "warning",
        title: "Low Trust Score",
        description: `Trust score is ${mb.trustScore.toFixed(0)} — consider reducing volume and improving engagement.`,
        mailbox: mb.email,
      });
    }
  }

  for (const dh of domainHealth) {
    if (dh.overallHealth === "critical") {
      riskAlerts.push({
        type: "dns",
        severity: "critical",
        title: "DNS Configuration Issues",
        description: dh.issues.join(". "),
        domain: dh.domain,
      });
    } else if (dh.overallHealth === "warning") {
      riskAlerts.push({
        type: "dns",
        severity: "warning",
        title: "DNS Incomplete",
        description: dh.issues.join(". "),
        domain: dh.domain,
      });
    }
  }

  // Sort alerts: critical first
  riskAlerts.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return NextResponse.json({
    domainHealth,
    mailboxes: mailboxData,
    riskAlerts,
  });
}
