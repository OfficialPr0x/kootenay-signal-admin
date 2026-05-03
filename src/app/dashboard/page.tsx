import { supabase } from "@/lib/db";
import { stripe, stripeConfigured } from "@/lib/stripe";
import Link from "next/link";

async function fxRate(from: string, to: string): Promise<number> {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${from.toUpperCase()}&to=${to.toUpperCase()}`,
      { next: { revalidate: 3600 } }
    );
    const json = await res.json();
    return json?.rates?.[to.toUpperCase()] ?? 1;
  } catch {
    return 1;
  }
}

async function getStats() {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    leadsRes,
    clientsRes,
    activeClientsRes,
    pausedClientsRes,
    churnedClientsRes,
    recentLeadsRes,
    allInvoicesRes,
    recentClientsRes,
    pendingInvoicesRes,
    overdueInvoicesRes,
    paidThisMonthRes,
    leadsByStatusRes,
    recentPaymentsRes,
  ] = await Promise.all([
    supabase.from("Lead").select("*", { count: "exact", head: true }),
    supabase.from("Client").select("*", { count: "exact", head: true }),
    supabase.from("Client").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("Client").select("*", { count: "exact", head: true }).eq("status", "paused"),
    supabase.from("Client").select("*", { count: "exact", head: true }).eq("status", "churned"),
    supabase.from("Lead").select("*").order("createdAt", { ascending: false }).limit(6),
    supabase.from("Invoice").select("amount, status, paymentSource"),
    supabase.from("Client").select("id, name, business, plan, monthlyRate, clientType, status, createdAt").order("createdAt", { ascending: false }).limit(5),
    supabase.from("Invoice").select("id, amount, dueDate, description, Client(name, business)").eq("status", "pending").order("dueDate", { ascending: true }).limit(5),
    supabase.from("Invoice").select("*", { count: "exact", head: true }).eq("status", "overdue"),
    supabase.from("Invoice").select("amount").eq("status", "paid").gte("paidAt", startOfMonth.toISOString()),
    supabase.from("Lead").select("status"),
    supabase.from("Payment").select("id, amount, method, reference, paidAt, Invoice(description, Client(name, business))").order("paidAt", { ascending: false }).limit(8),
  ]);

  const allInvoices = allInvoicesRes.data || [];
  const paidInvoices = allInvoices.filter((i) => i.status === "paid");
  const totalRevenue = paidInvoices.reduce((s: number, i) => s + (i.amount || 0), 0);
  const manualRevenue = paidInvoices.filter((i) => i.paymentSource === "manual").reduce((s: number, i) => s + (i.amount || 0), 0);
  const stripeInvoiceRevenue = paidInvoices.filter((i) => i.paymentSource === "stripe").reduce((s: number, i) => s + (i.amount || 0), 0);
  const unpaidSourceRevenue = paidInvoices.filter((i) => !i.paymentSource).reduce((s: number, i) => s + (i.amount || 0), 0);
  const paidThisMonth = (paidThisMonthRes.data || []).reduce((s: number, i) => s + (i.amount || 0), 0);
  const pendingTotal = (pendingInvoicesRes.data || []).reduce((s: number, i) => s + (i.amount || 0), 0);

  const leadStatuses = leadsByStatusRes.data || [];
  const leadFunnel = {
    new: leadStatuses.filter((l) => l.status === "new").length,
    contacted: leadStatuses.filter((l) => l.status === "contacted").length,
    qualified: leadStatuses.filter((l) => l.status === "qualified").length,
    converted: leadStatuses.filter((l) => l.status === "converted").length,
    lost: leadStatuses.filter((l) => l.status === "lost").length,
  };

  // Stripe data
  let stripeMrr = 0;
  let stripeBalance = 0;
  let stripeAccountCurrency = "USD";
  let stripeSubscriptions = 0;
  // All-time totals in account currency
  let stripeTotalNative = 0;
  // 30-day total in account currency
  let stripeRevenue30dNative = 0;
  // CAD-converted values (populated below)
  let stripeTotalCAD = 0;
  let stripeRevenue30dCAD = 0;
  let stripeToCADRate = 1;
  // All charges (last 100, covers most agencies)
  let stripeAllCharges: {
    id: string; amount: number; nativeAmount: number;
    currency: string; accountCurrency: string; status: string;
    customerName: string | null; customerEmail: string | null;
    createdAt: string; description: string | null; isLinkedToInvoice: boolean;
  }[] = [];

  if (stripeConfigured()) {
    try {
      const [subs, balanceRes, charges30d, chargesAll] = await Promise.all([
        stripe.subscriptions.list({ status: "active", limit: 100 }),
        stripe.balance.retrieve(),
        stripe.charges.list({ created: { gte: thirtyDaysAgo }, limit: 100, expand: ["data.balance_transaction"] }),
        // All-time last 100 charges for full picture
        stripe.charges.list({ limit: 100, expand: ["data.balance_transaction"] }),
      ]);

      stripeAccountCurrency = balanceRes.available[0]?.currency?.toUpperCase() || "USD";
      stripeBalance = (balanceRes.available[0]?.amount || 0) / 100;
      stripeSubscriptions = subs.data.length;

      // Get exchange rate: account currency → CAD
      stripeToCADRate = await fxRate(stripeAccountCurrency, "CAD");

      stripeMrr = subs.data.reduce((s, sub) => {
        const item = sub.items.data[0];
        if (!item?.price) return s;
        const amount = item.price.unit_amount || 0;
        const monthly = item.price.recurring?.interval === "year" ? amount / 12 : amount;
        return s + monthly;
      }, 0) / 100;

      // Helper: get settled amount in account currency from balance_transaction
      function btAmt(c: { balance_transaction: unknown; amount: number }): number {
        const bt = c.balance_transaction as { amount?: number } | null;
        return bt?.amount != null ? bt.amount / 100 : c.amount / 100;
      }

      // 30d total in account currency
      stripeRevenue30dNative = charges30d.data
        .filter((c) => c.status === "succeeded")
        .reduce((s, c) => s + btAmt(c), 0);
      stripeRevenue30dCAD = stripeRevenue30dNative * stripeToCADRate;

      // All-time total in account currency (from last 100 charges)
      stripeTotalNative = chargesAll.data
        .filter((c) => c.status === "succeeded")
        .reduce((s, c) => s + btAmt(c), 0);
      stripeTotalCAD = stripeTotalNative * stripeToCADRate;

      // Map to a clean shape for display; flag charges linked to our invoices (to avoid double-count note)
      stripeAllCharges = chargesAll.data.slice(0, 20).map((c) => ({
        id: c.id,
        amount: btAmt(c),                        // account currency (settled)
        nativeAmount: c.amount / 100,             // charge currency
        currency: stripeAccountCurrency,
        accountCurrency: stripeAccountCurrency,
        status: c.status,
        customerName: c.billing_details?.name || null,
        customerEmail: c.billing_details?.email || null,
        createdAt: new Date(c.created * 1000).toISOString(),
        description: c.description || null,
        isLinkedToInvoice: !!(c.metadata as Record<string, string>)?.invoiceId,
      }));
    } catch {
      // Stripe not reachable — keep defaults
    }
  }

  // Active client MRR from DB as fallback
  const activeClientsForMrr = await supabase
    .from("Client")
    .select("monthlyRate")
    .eq("status", "active")
    .neq("clientType", "one_off");
  const dbMrr = (activeClientsForMrr.data || []).reduce((s, c) => s + (c.monthlyRate || 0), 0);

  return {
    leadCount: leadsRes.count || 0,
    clientCount: clientsRes.count || 0,
    activeClients: activeClientsRes.count || 0,
    pausedClients: pausedClientsRes.count || 0,
    churnedClients: churnedClientsRes.count || 0,
    recentLeads: recentLeadsRes.data || [],
    recentClients: recentClientsRes.data || [],
    pendingInvoices: pendingInvoicesRes.data || [],
    overdueCount: overdueInvoicesRes.count || 0,
    // Invoice-based revenue (all from our DB, in CAD)
    totalRevenue,          // all paid invoices (manual + stripe-invoiced) in DB currency
    manualRevenue,
    stripeInvoiceRevenue,
    unpaidSourceRevenue,
    paidThisMonth,
    pendingTotal,
    leadFunnel,
    // Stripe live data
    stripeMrr,
    dbMrr,
    stripeBalance,
    stripeAccountCurrency,
    stripeTotalNative,         // all-time, account currency
    stripeTotalCAD,            // all-time, converted to CAD
    stripeRevenue30dNative,    // 30d, account currency
    stripeRevenue30dCAD,       // 30d, converted to CAD
    stripeToCADRate,
    stripeSubscriptions,
    stripeReady: stripeConfigured(),
    stripeAllCharges,
    recentPayments: (recentPaymentsRes.data || []) as {
      id: string;
      amount: number;
      method: string;
      reference: string | null;
      paidAt: string;
      Invoice: { description: string | null; Client: { name: string; business: string } | null } | null;
    }[],
  };
}

export default async function DashboardPage() {
  const s = await getStats();
  const mrr = s.stripeMrr > 0 ? s.stripeMrr : s.dbMrr;
  const conversionRate = s.leadCount > 0 ? Math.round((s.leadFunnel.converted / s.leadCount) * 100) : 0;

  // Combined all-source total in CAD:
  // DB invoices (manual + stripe-invoiced) + non-invoice Stripe charges converted to CAD
  const nonInvoicedStripeCAD = s.stripeReady
    ? (s.stripeTotalNative - (s.stripeInvoiceRevenue / s.stripeToCADRate)) * s.stripeToCADRate
    : 0;
  const combinedTotalCAD = s.totalRevenue + Math.max(0, nonInvoicedStripeCAD);

  // This month: local paid + Stripe 30d (subtract invoiced stripe to avoid double-count)
  const thisMonthCAD = s.paidThisMonth + Math.max(0, s.stripeRevenue30dCAD - s.stripeInvoiceRevenue);

  const cadFmt = (n: number, prefix = "C$") =>
    `${prefix}${n.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
  const nativeFmt = (n: number) =>
    `${s.stripeAccountCurrency}$${n.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Agency overview · {new Date().toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      {/* ── Primary KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Clients" value={s.activeClients} sub={`${s.pausedClients} paused · ${s.churnedClients} churned`} color="success" href="/dashboard/clients" />
        <StatCard label="Monthly Recurring" value={`C$${mrr.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`} sub={s.stripeMrr > 0 ? `${s.stripeSubscriptions} Stripe subs` : `${s.activeClients} retainer clients`} color="accent" href="/dashboard/billing" />
        <StatCard
          label="All-Source Revenue"
          value={cadFmt(combinedTotalCAD)}
          sub={s.stripeReady ? `incl. ${nativeFmt(s.stripeTotalNative)} Stripe` : `${cadFmt(s.totalRevenue)} invoiced`}
          color="warning"
          href="/dashboard/invoices"
        />
        <StatCard label="Pending Invoices" value={`C$${s.pendingTotal.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`} sub={`${s.overdueCount > 0 ? `${s.overdueCount} overdue · ` : ""}${s.pendingInvoices.length} open`} color={s.overdueCount > 0 ? "danger" : "info"} href="/dashboard/invoices" />
      </div>

      {/* ── Secondary KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={s.leadCount} sub={`${s.leadFunnel.new} new · ${s.leadFunnel.qualified} qualified`} color="info" href="/dashboard/leads" size="sm" />
        <StatCard label="Conversion Rate" value={`${conversionRate}%`} sub={`${s.leadFunnel.converted} converted of ${s.leadCount}`} color="success" href="/dashboard/leads" size="sm" />
        {s.stripeReady ? (
          <StatCard
            label="Stripe Balance"
            value={`${s.stripeAccountCurrency}$${s.stripeBalance.toLocaleString("en-CA", { maximumFractionDigits: 2 })}`}
            sub={`${s.stripeAccountCurrency} · available payout`}
            color="accent"
            href="/dashboard/billing"
            size="sm"
          />
        ) : (
          <StatCard label="Total Clients" value={s.clientCount} sub="all time" color="muted" href="/dashboard/clients" size="sm" />
        )}
        <StatCard
          label={s.stripeReady ? "This Month (all sources)" : "Paid This Month"}
          value={cadFmt(thisMonthCAD)}
          sub={s.stripeReady ? `${nativeFmt(s.stripeRevenue30dNative)} Stripe + C$${s.paidThisMonth.toFixed(0)} invoiced` : `C$${s.totalRevenue.toLocaleString("en-CA", { maximumFractionDigits: 0 })} all-time`}
          color="warning"
          href="/dashboard/invoices"
          size="sm"
        />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Lead funnel */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Lead Pipeline</h3>
            <Link href="/dashboard/leads" className="text-accent text-[12px] hover:text-accent-hover transition">View all</Link>
          </div>
          <div className="panel-body space-y-2.5">
            {(["new", "contacted", "qualified", "converted", "lost"] as const).map((status) => {
              const count = s.leadFunnel[status];
              const pct = s.leadCount > 0 ? Math.round((count / s.leadCount) * 100) : 0;
              const colors: Record<string, string> = {
                new: "bg-info", contacted: "bg-warning", qualified: "bg-accent",
                converted: "bg-success", lost: "bg-danger",
              };
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-muted capitalize">{status}</span>
                    <span className="text-[12px] font-semibold text-foreground">{count} <span className="text-muted font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-card-hover overflow-hidden">
                    <div className={`h-full rounded-full ${colors[status]} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending invoices */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Open Invoices</h3>
            <Link href="/dashboard/invoices" className="text-accent text-[12px] hover:text-accent-hover transition">View all</Link>
          </div>
          {s.pendingInvoices.length === 0 ? (
            <p className="px-5 py-8 text-muted text-[13px] text-center">No open invoices</p>
          ) : (
            <div className="divide-y divide-border">
              {s.pendingInvoices.map((inv) => {
                const client = inv.Client as { name: string; business: string } | null;
                const due = new Date(inv.dueDate);
                const isOverdue = due < new Date();
                return (
                  <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{client?.name || "—"}</p>
                      <p className="text-[11px] text-muted truncate">{inv.description || client?.business || "—"}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-[13px] font-semibold font-mono text-foreground">${inv.amount.toLocaleString()}</p>
                      <p className={`text-[10px] ${isOverdue ? "text-danger" : "text-muted"}`}>
                        {isOverdue ? "OVERDUE · " : "Due "}{due.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent clients */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Recent Clients</h3>
            <Link href="/dashboard/clients" className="text-accent text-[12px] hover:text-accent-hover transition">View all</Link>
          </div>
          {s.recentClients.length === 0 ? (
            <p className="px-5 py-8 text-muted text-[13px] text-center">No clients yet</p>
          ) : (
            <div className="divide-y divide-border">
              {s.recentClients.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center text-accent text-[11px] font-bold shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted truncate">{c.plan}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-[12px] font-semibold text-accent">${(c.monthlyRate || 0).toLocaleString()}{c.clientType !== "one_off" ? "/mo" : ""}</p>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent leads */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Recent Leads</h3>
            <Link href="/dashboard/leads" className="text-accent text-[12px] hover:text-accent-hover transition">View all</Link>
          </div>
          {s.recentLeads.length === 0 ? (
            <p className="px-5 py-8 text-muted text-[13px] text-center">No leads yet</p>
          ) : (
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Business</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {s.recentLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <p className="font-medium text-foreground">{lead.name}</p>
                      <p className="text-[11px] text-muted">{lead.email}</p>
                    </td>
                    <td className="text-[12px] text-muted">{lead.business || "—"}</td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td className="text-muted text-[12px]">{new Date(lead.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Revenue by Source */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Revenue by Source</h3>
            <Link href="/dashboard/billing" className="text-accent text-[12px] hover:text-accent-hover transition">Full billing →</Link>
          </div>
          <div className="panel-body space-y-3">
            {/* Combined total */}
            <div className="rounded-lg bg-accent/8 border border-accent/20 px-4 py-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">All Sources (≈ CAD)</span>
                <span className="text-[22px] font-bold font-mono text-accent">{cadFmt(combinedTotalCAD)}</span>
              </div>
              {s.stripeReady && s.stripeToCADRate !== 1 && (
                <p className="text-[10px] text-muted mt-1">1 {s.stripeAccountCurrency} ≈ {s.stripeToCADRate.toFixed(4)} CAD</p>
              )}
            </div>
            {/* Per-source rows */}
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden text-[12px]">
              {/* Stripe all-time */}
              {s.stripeReady && (
                <div className="flex items-center justify-between px-4 py-3 bg-card">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-info shrink-0" />
                    <div className="min-w-0">
                      <span className="text-muted">Stripe charges (all-time)</span>
                      <span className="ml-2 text-[10px] text-muted/60">last 100 · succeeded</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="font-mono font-semibold text-info">{nativeFmt(s.stripeTotalNative)}</span>
                    {s.stripeToCADRate !== 1 && (
                      <span className="block text-[10px] text-muted">≈ {cadFmt(s.stripeTotalCAD)}</span>
                    )}
                  </div>
                </div>
              )}
              {/* Stripe 30d */}
              {s.stripeReady && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-card">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-info/40 shrink-0" />
                    <span className="text-muted/70">↳ Last 30 days</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-info/80">{nativeFmt(s.stripeRevenue30dNative)}</span>
                    {s.stripeToCADRate !== 1 && (
                      <span className="ml-1 text-[10px] text-muted">≈ {cadFmt(s.stripeRevenue30dCAD)}</span>
                    )}
                  </div>
                </div>
              )}
              {/* Manual payments */}
              <div className="flex items-center justify-between px-4 py-3 bg-card">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                  <span className="text-muted">Manual (cash · e-transfer · cheque)</span>
                </div>
                <span className="font-mono font-semibold text-success">C${s.manualRevenue.toLocaleString("en-CA", { maximumFractionDigits: 0 })}</span>
              </div>
              {/* Stripe-invoiced (through our pay links) */}
              {s.stripeInvoiceRevenue > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-card">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                    <span className="text-muted">Stripe Pay Link (invoiced)</span>
                  </div>
                  <span className="font-mono font-semibold text-accent">C${s.stripeInvoiceRevenue.toLocaleString("en-CA", { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              {/* Untracked (marked paid, no source) */}
              {s.unpaidSourceRevenue > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-card">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-muted shrink-0" />
                    <span className="text-muted">Untracked (marked paid manually)</span>
                  </div>
                  <span className="font-mono text-muted">C${s.unpaidSourceRevenue.toLocaleString("en-CA", { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              {/* Pending */}
              <div className="flex items-center justify-between px-4 py-3 bg-card">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                  <span className="text-muted">Outstanding invoices</span>
                </div>
                <span className="font-mono font-semibold text-warning">C${s.pendingTotal.toLocaleString("en-CA", { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
            {!s.stripeReady && (
              <p className="text-center pt-1">
                <Link href="/dashboard/billing" className="text-[11px] text-accent hover:underline">Connect Stripe for live charge data →</Link>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Payments (local) + Stripe Charges — unified view ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Local payments from our DB */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Collected Payments</h3>
            <Link href="/dashboard/invoices" className="text-accent text-[12px] hover:text-accent-hover transition">All invoices</Link>
          </div>
          {s.recentPayments.length === 0 ? (
            <p className="px-5 py-8 text-muted text-[13px] text-center">No payments yet — use <strong>Collect</strong> on an invoice</p>
          ) : (
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {s.recentPayments.map((p) => {
                  const client = p.Invoice?.Client;
                  const methodLabel: Record<string, string> = {
                    cash: "Cash", e_transfer: "E-Transfer", cheque: "Cheque",
                    bank: "Bank/EFT", stripe: "Stripe", other: "Other",
                  };
                  return (
                    <tr key={p.id}>
                      <td>
                        <p className="font-medium text-foreground">{client?.name || "—"}</p>
                        <p className="text-[10px] text-muted truncate max-w-[120px]">{p.Invoice?.description || client?.business || ""}</p>
                      </td>
                      <td>
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${p.method === "stripe" ? "bg-info/10 text-info" : "bg-success/10 text-success"}`}>
                          {methodLabel[p.method] || p.method}
                        </span>
                        {p.reference && <p className="text-[10px] text-muted mt-0.5">{p.reference}</p>}
                      </td>
                      <td className="font-mono font-semibold text-foreground">C${p.amount.toFixed(2)}</td>
                      <td className="text-muted text-[11px]">{new Date(p.paidAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Stripe charges — live from Stripe API */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Stripe Charges</h3>
            <Link href="/dashboard/billing" className="text-accent text-[12px] hover:text-accent-hover transition">Full billing →</Link>
          </div>
          {!s.stripeReady ? (
            <p className="px-5 py-8 text-muted text-[13px] text-center">
              <Link href="/dashboard/billing" className="text-accent hover:underline">Connect Stripe</Link> to see live charges
            </p>
          ) : s.stripeAllCharges.length === 0 ? (
            <p className="px-5 py-8 text-muted text-[13px] text-center">No Stripe charges found</p>
          ) : (
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {s.stripeAllCharges.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="font-medium text-foreground">{c.customerName || "—"}</p>
                      <p className="text-[10px] text-muted truncate max-w-[120px]">{c.customerEmail || (c.description ? c.description.slice(0, 30) : c.id.slice(0, 12) + "…")}</p>
                    </td>
                    <td>
                      <span className="font-mono font-semibold text-foreground">{c.accountCurrency}${c.amount.toFixed(2)}</span>
                      {c.isLinkedToInvoice && (
                        <span className="block text-[10px] text-accent">via invoice</span>
                      )}
                    </td>
                    <td><StatusBadge status={c.status === "succeeded" ? "paid" : c.status} /></td>
                    <td className="text-muted text-[11px]">{new Date(c.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, color, href, size = "md",
}: {
  label: string; value: string | number; sub: string; color: string; href: string; size?: "md" | "sm";
}) {
  const colorMap: Record<string, { text: string; glow: string }> = {
    success: { text: "text-success", glow: "bg-success/8" },
    accent:  { text: "text-accent",  glow: "bg-accent/8"  },
    warning: { text: "text-warning", glow: "bg-warning/8" },
    danger:  { text: "text-danger",  glow: "bg-danger/8"  },
    info:    { text: "text-info",    glow: "bg-info/8"    },
    muted:   { text: "text-muted",   glow: "bg-card-hover"},
  };
  const { text, glow } = colorMap[color] || colorMap.muted;

  return (
    <Link href={href} className="stat-card rounded-xl group hover:bg-card-hover transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</span>
        <span className={`w-2 h-2 rounded-full ${glow} ${text}`} style={{ boxShadow: "0 0 6px currentColor" }} />
      </div>
      <p className={`font-semibold tracking-tight leading-none ${text} ${size === "sm" ? "text-[22px]" : "text-[28px]"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted mt-2 truncate">{sub}</p>}
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "badge-info", contacted: "badge-warning", qualified: "badge-accent",
    converted: "badge-success", lost: "badge-danger", active: "badge-success",
    succeeded: "badge-success", paused: "badge-warning", churned: "badge-danger",
    pending: "badge-warning", paid: "badge-success", overdue: "badge-danger",
  };
  return <span className={`badge ${styles[status] || "badge-muted"}`}>{status}</span>;
}
