"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconPlus, IconRefresh, IconGlobe, IconCheck, IconX,
  IconTrash, IconMail, IconShield, IconAlert, IconEdit,
} from "@/components/icons";

/* ── Types ── */

interface ResendDomain {
  id: string;
  name: string;
  status: string;
  region: string;
  created_at: string;
  records?: DnsRecord[];
}

interface DnsRecord {
  record: string;
  name: string;
  type: string;
  ttl: string;
  status: string;
  value: string;
  priority?: number;
}

interface EmailAccount {
  id: string;
  email: string;
  name: string;
  isDefault: boolean;
  domainId: string | null;
  warmupStatus: string;
  dailySendLimit: number;
  currentVolume: number;
  trustScore: number;
  createdAt: string;
}

const DOMAIN_STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  verified:       { badge: "badge-success", label: "Verified" },
  not_started:    { badge: "badge-muted",   label: "Pending" },
  pending:        { badge: "badge-warning", label: "Verifying" },
  temporary_failure: { badge: "badge-warning", label: "Retry" },
  failed:         { badge: "badge-danger",  label: "Failed" },
};

const WARMUP_STYLES: Record<string, { badge: string; label: string }> = {
  none:    { badge: "badge-muted",   label: "None" },
  warming: { badge: "badge-warning", label: "Warming" },
  stable:  { badge: "badge-success", label: "Stable" },
  at_risk: { badge: "badge-danger",  label: "At Risk" },
  paused:  { badge: "badge-muted",   label: "Paused" },
};

export default function AccountsPage() {
  const [domains, setDomains] = useState<ResendDomain[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Domain form
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [domainName, setDomainName] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);

  // Account form
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [acctEmail, setAcctEmail] = useState("");
  const [acctName, setAcctName] = useState("");
  const [acctDomain, setAcctDomain] = useState("");
  const [acctLimit, setAcctLimit] = useState(50);
  const [acctDefault, setAcctDefault] = useState(false);
  const [savingAcct, setSavingAcct] = useState(false);

  // DNS records view
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [domainDetail, setDomainDetail] = useState<ResendDomain | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Editing account
  const [editingAcct, setEditingAcct] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLimit, setEditLimit] = useState(50);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [domRes, acctRes] = await Promise.all([
        fetch("/api/email/domains"),
        fetch("/api/email/accounts"),
      ]);

      if (domRes.ok) {
        const domData = await domRes.json();
        setDomains(domData?.data || []);
      } else {
        const domErr = await domRes.json();
        setError(domErr.error || "Failed to load domains");
      }

      if (acctRes.ok) {
        const acctData = await acctRes.json();
        setAccounts(acctData.accounts || []);
      }
    } catch {
      setError("Failed to connect to API");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function addDomain() {
    if (!domainName.trim()) return;
    setSavingDomain(true);
    try {
      const res = await fetch("/api/email/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: domainName.trim() }),
      });
      if (res.ok) {
        setShowAddDomain(false);
        setDomainName("");
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add domain");
      }
    } catch { setError("Failed to add domain"); }
    setSavingDomain(false);
  }

  async function verifyDomain(id: string) {
    try {
      await fetch(`/api/email/domains/${id}`, { method: "POST" });
      fetchData();
      if (expandedDomain === id) fetchDomainDetail(id);
    } catch { /* empty */ }
  }

  async function deleteDomain(id: string) {
    if (!confirm("Delete this domain? This cannot be undone.")) return;
    try {
      await fetch(`/api/email/domains/${id}`, { method: "DELETE" });
      if (expandedDomain === id) {
        setExpandedDomain(null);
        setDomainDetail(null);
      }
      fetchData();
    } catch { /* empty */ }
  }

  async function fetchDomainDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/email/domains/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDomainDetail(data);
      }
    } catch { /* empty */ }
    setDetailLoading(false);
  }

  function handleExpandDomain(id: string) {
    if (expandedDomain === id) {
      setExpandedDomain(null);
      setDomainDetail(null);
    } else {
      setExpandedDomain(id);
      fetchDomainDetail(id);
    }
  }

  async function addAccount() {
    if (!acctEmail.trim() || !acctName.trim()) return;
    setSavingAcct(true);
    setError(null);
    try {
      const res = await fetch("/api/email/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: acctEmail.trim(),
          name: acctName.trim(),
          domainId: acctDomain || null,
          dailySendLimit: acctLimit,
          isDefault: acctDefault,
        }),
      });
      if (res.ok) {
        setShowAddAccount(false);
        setAcctEmail(""); setAcctName(""); setAcctDomain(""); setAcctLimit(50); setAcctDefault(false);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create account");
      }
    } catch { setError("Failed to create account"); }
    setSavingAcct(false);
  }

  async function deleteAccount(id: string) {
    if (!confirm("Delete this email account?")) return;
    try {
      await fetch(`/api/email/accounts/${id}`, { method: "DELETE" });
      fetchData();
    } catch { /* empty */ }
  }

  async function updateAccount(id: string) {
    try {
      await fetch(`/api/email/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, dailySendLimit: editLimit }),
      });
      setEditingAcct(null);
      fetchData();
    } catch { /* empty */ }
  }

  async function setDefault(id: string) {
    await fetch(`/api/email/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    fetchData();
  }

  if (loading) {
    return <div className="panel p-8 text-center text-muted text-[13px]">Loading accounts & domains...</div>;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-[12px] flex items-center gap-2">
          <IconAlert size={14} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto cursor-pointer"><IconX size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* ── Domains Panel ── */}
        <div>
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-[14px] font-semibold flex items-center gap-2">
                <IconGlobe size={16} className="text-accent" />
                Sending Domains
              </h3>
              <div className="flex gap-2">
                <button onClick={() => fetchData()} className="btn-ghost !py-1.5 !text-[11px] cursor-pointer">
                  <IconRefresh size={12} />
                </button>
                <button onClick={() => setShowAddDomain(!showAddDomain)} className="btn-primary !py-1.5 !text-[11px] cursor-pointer">
                  <IconPlus size={12} /> Add Domain
                </button>
              </div>
            </div>

            {showAddDomain && (
              <div className="p-4 border-b border-border bg-card-elevated space-y-3">
                <div>
                  <label className="text-[10px] text-muted block mb-1">Domain Name</label>
                  <input
                    type="text"
                    value={domainName}
                    onChange={e => setDomainName(e.target.value)}
                    className="input-field !text-[12px]"
                    placeholder="e.g. mail.yourdomain.com"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    Use a subdomain like <span className="text-foreground">mail.yourdomain.com</span> to protect your main domain reputation
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddDomain(false); setDomainName(""); }} className="btn-ghost !text-[11px] !py-1.5 flex-1 cursor-pointer">Cancel</button>
                  <button onClick={addDomain} disabled={savingDomain || !domainName.trim()} className="btn-primary !text-[11px] !py-1.5 flex-1 cursor-pointer">
                    {savingDomain ? "Adding..." : "Add Domain"}
                  </button>
                </div>
              </div>
            )}

            {domains.length === 0 && !showAddDomain ? (
              <div className="p-8 text-center text-muted text-[13px]">
                <IconGlobe size={32} className="mx-auto mb-3 opacity-20" />
                <p>No domains configured</p>
                <p className="text-[11px] mt-2 opacity-60">Add a sending domain to start sending emails</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {domains.map(d => {
                  const statusInfo = DOMAIN_STATUS_STYLES[d.status] || DOMAIN_STATUS_STYLES.not_started;
                  const isExpanded = expandedDomain === d.id;

                  return (
                    <div key={d.id}>
                      <div
                        className="p-4 hover:bg-card-hover transition cursor-pointer"
                        onClick={() => handleExpandDomain(d.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <IconGlobe size={14} className="text-muted" />
                              <span className="text-[13px] font-medium text-foreground">{d.name}</span>
                              <span className={`badge !text-[10px] ${statusInfo.badge}`}>{statusInfo.label}</span>
                            </div>
                            <p className="text-[10px] text-muted mt-1 ml-[22px]">
                              Region: {d.region || "us-east-1"} · Added {new Date(d.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            {d.status !== "verified" && (
                              <button onClick={() => verifyDomain(d.id)} className="btn-ghost !py-1 !px-2 !text-[11px] cursor-pointer !text-accent">
                                <IconShield size={12} /> Verify
                              </button>
                            )}
                            <button onClick={() => deleteDomain(d.id)} className="btn-ghost !py-1 !px-2 !text-[11px] cursor-pointer !text-danger">
                              <IconTrash size={12} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* DNS Records */}
                      {isExpanded && (
                        <div className="border-t border-border bg-card-elevated p-4">
                          {detailLoading ? (
                            <p className="text-[12px] text-muted text-center py-4">Loading DNS records...</p>
                          ) : domainDetail?.records && domainDetail.records.length > 0 ? (
                            <div>
                              <h4 className="text-[12px] font-semibold text-foreground mb-3 flex items-center gap-1.5">
                                <IconShield size={14} className="text-accent" />
                                DNS Records — Add these to your DNS provider
                              </h4>
                              <table className="brand-table">
                                <thead>
                                  <tr>
                                    <th>Type</th>
                                    <th>Name</th>
                                    <th>Value</th>
                                    <th>TTL</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {domainDetail.records.map((rec, i) => (
                                    <tr key={i}>
                                      <td>
                                        <span className="badge !text-[9px] badge-info">{rec.type}</span>
                                      </td>
                                      <td className="text-[11px] text-foreground font-mono max-w-[150px] truncate" title={rec.name}>
                                        {rec.name}
                                      </td>
                                      <td className="text-[11px] text-muted-foreground font-mono max-w-[250px]">
                                        <div className="truncate" title={rec.value}>{rec.value}</div>
                                      </td>
                                      <td className="text-[11px] text-muted">{rec.ttl}</td>
                                      <td>
                                        <span className={`badge !text-[9px] ${rec.status === "verified" ? "badge-success" : "badge-warning"}`}>
                                          {rec.status === "verified" ? "✓" : "Pending"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <p className="text-[10px] text-muted mt-3">
                                Add these records to your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.), then click Verify.
                              </p>
                            </div>
                          ) : (
                            <p className="text-[12px] text-muted text-center py-4">No DNS records available. Click Verify to check status.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Email Accounts Panel ── */}
        <div>
          <div className="panel">
            <div className="panel-header">
              <h3 className="text-[14px] font-semibold flex items-center gap-2">
                <IconMail size={16} className="text-accent" />
                Email Accounts
              </h3>
              <button onClick={() => setShowAddAccount(!showAddAccount)} className="btn-primary !py-1.5 !text-[11px] cursor-pointer">
                <IconPlus size={12} /> Add Account
              </button>
            </div>

            {showAddAccount && (
              <div className="p-4 border-b border-border bg-card-elevated space-y-3">
                <div>
                  <label className="text-[10px] text-muted block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={acctEmail}
                    onChange={e => setAcctEmail(e.target.value)}
                    className="input-field !text-[12px]"
                    placeholder="e.g. jaryd@mail.yourdomain.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Display Name</label>
                  <input
                    type="text"
                    value={acctName}
                    onChange={e => setAcctName(e.target.value)}
                    className="input-field !text-[12px]"
                    placeholder="e.g. Jaryd - Kootenay Signal"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Resend Domain ID (optional)</label>
                    <select
                      value={acctDomain}
                      onChange={e => setAcctDomain(e.target.value)}
                      className="input-field !text-[12px]"
                    >
                      <option value="">No domain linked</option>
                      {domains.map(d => (
                        <option key={d.id} value={d.id}>{d.name} {d.status === "verified" ? "✓" : "(pending)"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Daily Send Limit</label>
                    <input
                      type="number"
                      value={acctLimit}
                      onChange={e => setAcctLimit(parseInt(e.target.value) || 50)}
                      className="input-field !text-[12px]"
                      min={1}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acctDefault}
                    onChange={e => setAcctDefault(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-[11px] text-muted-foreground">Set as default sending account</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddAccount(false); setAcctEmail(""); setAcctName(""); }} className="btn-ghost !text-[11px] !py-1.5 flex-1 cursor-pointer">Cancel</button>
                  <button onClick={addAccount} disabled={savingAcct || !acctEmail.trim() || !acctName.trim()} className="btn-primary !text-[11px] !py-1.5 flex-1 cursor-pointer">
                    {savingAcct ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </div>
            )}

            {accounts.length === 0 && !showAddAccount ? (
              <div className="p-8 text-center text-muted text-[13px]">
                <IconMail size={32} className="mx-auto mb-3 opacity-20" />
                <p>No email accounts yet</p>
                <p className="text-[11px] mt-2 opacity-60">Create an email account to start sending and warming up</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {accounts.map(acct => {
                  const warmup = WARMUP_STYLES[acct.warmupStatus] || WARMUP_STYLES.none;
                  const isEditing = editingAcct === acct.id;

                  return (
                    <div key={acct.id} className="p-4 hover:bg-card-hover transition">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="input-field !text-[12px]"
                            placeholder="Display name"
                          />
                          <input
                            type="number"
                            value={editLimit}
                            onChange={e => setEditLimit(parseInt(e.target.value) || 50)}
                            className="input-field !text-[12px]"
                            min={1}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setEditingAcct(null)} className="btn-ghost !text-[11px] !py-1 flex-1 cursor-pointer">Cancel</button>
                            <button onClick={() => updateAccount(acct.id)} className="btn-primary !text-[11px] !py-1 flex-1 cursor-pointer">Save</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-foreground">{acct.email}</span>
                                {acct.isDefault && (
                                  <span className="badge !text-[9px] badge-accent">Default</span>
                                )}
                                <span className={`badge !text-[9px] ${warmup.badge}`}>{warmup.label}</span>
                              </div>
                              <p className="text-[11px] text-muted mt-0.5">{acct.name}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {!acct.isDefault && (
                                <button
                                  onClick={() => setDefault(acct.id)}
                                  className="btn-ghost !py-1 !px-2 !text-[10px] cursor-pointer"
                                  title="Set as default"
                                >
                                  <IconCheck size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => { setEditingAcct(acct.id); setEditName(acct.name); setEditLimit(acct.dailySendLimit); }}
                                className="btn-ghost !py-1 !px-2 !text-[10px] cursor-pointer"
                              >
                                <IconEdit size={12} />
                              </button>
                              <button
                                onClick={() => deleteAccount(acct.id)}
                                className="btn-ghost !py-1 !px-2 !text-[10px] cursor-pointer !text-danger"
                              >
                                <IconTrash size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <span className="text-[10px] text-muted">Daily Limit</span>
                              <p className="text-[13px] font-semibold text-foreground">{acct.dailySendLimit}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted">Volume Today</span>
                              <p className="text-[13px] font-semibold text-foreground">{acct.currentVolume}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted">Trust Score</span>
                              <p className={`text-[13px] font-semibold ${
                                acct.trustScore >= 80 ? "text-success" : acct.trustScore >= 60 ? "text-warning" : acct.trustScore > 0 ? "text-danger" : "text-muted"
                              }`}>
                                {acct.trustScore > 0 ? acct.trustScore.toFixed(0) : "—"}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Setup Guide */}
          <div className="panel mt-4">
            <div className="panel-header">
              <h3 className="text-[14px] font-semibold">Quick Setup</h3>
            </div>
            <div className="panel-body space-y-3 text-[12px]">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 text-[11px] font-bold">1</div>
                <div>
                  <p className="text-foreground font-medium">Add a sending domain</p>
                  <p className="text-muted text-[11px]">Register your domain (e.g. mail.yourdomain.com) with Resend</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 text-[11px] font-bold">2</div>
                <div>
                  <p className="text-foreground font-medium">Configure DNS records</p>
                  <p className="text-muted text-[11px]">Add the SPF, DKIM, and DMARC records to your DNS provider</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 text-[11px] font-bold">3</div>
                <div>
                  <p className="text-foreground font-medium">Verify the domain</p>
                  <p className="text-muted text-[11px]">Click Verify and wait for DNS propagation (can take up to 72h)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 text-[11px] font-bold">4</div>
                <div>
                  <p className="text-foreground font-medium">Create email accounts</p>
                  <p className="text-muted text-[11px]">Add sender identities linked to your verified domain</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center flex-shrink-0 text-[11px] font-bold">5</div>
                <div>
                  <p className="text-foreground font-medium">Start warmup</p>
                  <p className="text-muted text-[11px]">Go to the Warmup tab and assign a profile to build reputation</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
