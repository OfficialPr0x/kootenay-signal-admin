"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconShield, IconRefresh, IconCheck, IconX, IconAlert, IconTrendUp,
} from "@/components/icons";

interface Domain {
  id: string;
  domain: string;
  status: string;
  createdAt: string;
  records: { type: string; name: string; value: string; status: string }[];
}

interface DomainHealth {
  domain: string;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
  overallHealth: string;
  issues: string[];
}

interface MailboxHealth {
  id: string;
  email: string;
  trustScore: number;
  dailySendLimit: number;
  currentVolume: number;
  warmupStatus: string;
  bounceRate: number;
  replyRate: number;
  complaintRate: number;
}

interface RiskAlert {
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  mailbox?: string;
  domain?: string;
}

export default function DeliverabilityPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainHealth, setDomainHealth] = useState<DomainHealth[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxHealth[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [domRes, healthRes] = await Promise.all([
        fetch("/api/email/domains"),
        fetch("/api/deliverability"),
      ]);
      const domData = await domRes.json();
      const healthData = await healthRes.json();
      setDomains(domData.domains || []);
      setDomainHealth(healthData.domainHealth || []);
      setMailboxes(healthData.mailboxes || []);
      setRiskAlerts(healthData.riskAlerts || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function dnsIcon(status: string) {
    if (status === "verified" || status === "pass") {
      return <IconCheck size={14} className="text-success" />;
    }
    if (status === "fail") {
      return <IconX size={14} className="text-danger" />;
    }
    return <span className="text-[10px] text-muted">?</span>;
  }

  function severityBadge(severity: string) {
    const styles: Record<string, string> = {
      critical: "badge-danger",
      warning: "badge-warning",
      info: "badge-info",
    };
    return styles[severity] || "badge-muted";
  }

  function trustBar(score: number) {
    const color = score >= 80 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-danger";
    return (
      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
    );
  }

  if (loading) {
    return <div className="panel p-8 text-center text-muted text-[13px]">Loading deliverability data...</div>;
  }

  // Calculate overall health score
  const avgTrust = mailboxes.length > 0 ? mailboxes.reduce((s, m) => s + m.trustScore, 0) / mailboxes.length : 0;
  const criticalAlerts = riskAlerts.filter(a => a.severity === "critical").length;
  const warningAlerts = riskAlerts.filter(a => a.severity === "warning").length;

  return (
    <div>
      {/* Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Overall Health</span>
          <p className={`text-[28px] font-semibold mt-1 ${
            avgTrust >= 80 ? "text-success" : avgTrust >= 60 ? "text-warning" : "text-danger"
          }`}>
            {avgTrust.toFixed(0)}
          </p>
          <p className="text-[11px] text-muted mt-1">Avg trust score</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Domains</span>
          <p className="text-[28px] font-semibold text-foreground mt-1">{domains.length}</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Critical Alerts</span>
          <p className={`text-[28px] font-semibold mt-1 ${criticalAlerts > 0 ? "text-danger" : "text-success"}`}>
            {criticalAlerts}
          </p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Warnings</span>
          <p className={`text-[28px] font-semibold mt-1 ${warningAlerts > 0 ? "text-warning" : "text-success"}`}>
            {warningAlerts}
          </p>
        </div>
      </div>

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="panel mb-4">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold flex items-center gap-2">
              <IconAlert size={14} className="text-warning" /> Risk Alerts
            </h3>
          </div>
          <div className="divide-y divide-border">
            {riskAlerts.map((alert, i) => (
              <div key={i} className="p-3 flex items-start gap-3">
                <span className={`badge !text-[9px] mt-0.5 ${severityBadge(alert.severity)}`}>{alert.severity}</span>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-foreground">{alert.title}</p>
                  <p className="text-[11px] text-muted mt-0.5">{alert.description}</p>
                  {(alert.mailbox || alert.domain) && (
                    <p className="text-[10px] text-muted mt-0.5 opacity-60">
                      {alert.mailbox ? `Mailbox: ${alert.mailbox}` : `Domain: ${alert.domain}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Domain DNS Health */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Domain DNS Health</h3>
            <button onClick={fetchData} className="btn-ghost !text-[11px] !py-1.5 cursor-pointer">
              <IconRefresh size={12} /> Check
            </button>
          </div>

          {domains.length === 0 ? (
            <div className="p-8 text-center text-muted text-[13px]">
              <IconShield size={28} className="mx-auto mb-2 opacity-20" />
              <p>No domains configured</p>
              <p className="text-[11px] mt-1 opacity-60">Add domains via the Resend dashboard</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {domains.map(d => {
                const health = domainHealth.find(h => h.domain === d.domain);
                return (
                  <div key={d.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium text-foreground">{d.domain}</span>
                      <span className={`badge !text-[10px] ${d.status === "verified" ? "badge-success" : "badge-warning"}`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {["SPF", "DKIM", "DMARC"].map(check => {
                        const key = `${check.toLowerCase()}Status` as keyof DomainHealth;
                        const status = health?.[key] as string || "unknown";
                        return (
                          <div key={check} className="flex items-center gap-1.5 p-2 rounded bg-card-elevated">
                            {dnsIcon(status)}
                            <span className="text-[11px] text-foreground">{check}</span>
                            <span className="text-[10px] text-muted ml-auto capitalize">{status}</span>
                          </div>
                        );
                      })}
                    </div>
                    {health?.issues && health.issues.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {health.issues.map((issue, i) => (
                          <p key={i} className="text-[11px] text-danger flex items-center gap-1">
                            <IconAlert size={10} /> {issue}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* DNS Records */}
                    {d.records && d.records.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">DNS Records</p>
                        <div className="space-y-1">
                          {d.records.map((r, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] font-mono p-1.5 rounded bg-card-elevated">
                              <span className="text-accent">{r.type}</span>
                              <span className="text-muted truncate flex-1">{r.name}</span>
                              {dnsIcon(r.status)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mailbox Trust Scores */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Mailbox Trust Scores</h3>
          </div>

          {mailboxes.length === 0 ? (
            <div className="p-8 text-center text-muted text-[13px]">No mailboxes configured</div>
          ) : (
            <div className="divide-y divide-border">
              {mailboxes.sort((a, b) => a.trustScore - b.trustScore).map(mb => (
                <div key={mb.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium text-foreground">{mb.email}</span>
                    <span className={`text-[14px] font-semibold ${
                      mb.trustScore >= 80 ? "text-success" : mb.trustScore >= 60 ? "text-warning" : "text-danger"
                    }`}>
                      {mb.trustScore.toFixed(0)}
                    </span>
                  </div>
                  {trustBar(mb.trustScore)}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <span className="text-[10px] text-muted">Bounce</span>
                      <p className={`text-[12px] font-medium ${mb.bounceRate > 5 ? "text-danger" : "text-foreground"}`}>
                        {mb.bounceRate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted">Reply</span>
                      <p className="text-[12px] font-medium text-foreground">{mb.replyRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted">Complaints</span>
                      <p className={`text-[12px] font-medium ${mb.complaintRate > 0.1 ? "text-danger" : "text-foreground"}`}>
                        {mb.complaintRate.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-muted">
                    <span>Volume: {mb.currentVolume}/{mb.dailySendLimit}</span>
                    <span>·</span>
                    <span className="capitalize">Warmup: {mb.warmupStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
