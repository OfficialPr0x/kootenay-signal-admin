import { supabase } from "@/lib/db";
import { stripe, stripeConfigured } from "@/lib/stripe";
import Link from "next/link";

async function getStats() {
  const [leadsRes, clientsRes, activeClientsRes, recentLeadsRes, invoicesRes, emailsSentRes] =
    await Promise.all([
      supabase.from("Lead").select("*", { count: "exact", head: true }),
      supabase.from("Client").select("*", { count: "exact", head: true }),
      supabase.from("Client").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("Lead").select("*").order("createdAt", { ascending: false }).limit(5),
      supabase.from("Invoice").select("amount").eq("status", "paid"),
      supabase.from("EmailLog").select("*", { count: "exact", head: true }),
    ]);

  const invoiceRevenue = (invoicesRes.data || []).reduce((sum: number, i: Record<string, number>) => sum + (i.amount || 0), 0);

  // Pull MRR from Stripe if configured
  let stripeMrr: number | null = null;
  if (stripeConfigured()) {
    try {
      const subs = await stripe.subscriptions.list({ status: "active", limit: 100 });
      stripeMrr = subs.data.reduce((s, sub) => {
        const item = sub.items.data[0];
        if (!item?.price) return s;
        const amount = item.price.unit_amount || 0;
        const interval = item.price.recurring?.interval;
        const monthly = interval === "year" ? amount / 12 : amount;
        return s + monthly;
      }, 0) / 100;
    } catch {
      stripeMrr = null;
    }
  }

  return {
    leadCount: leadsRes.count || 0,
    clientCount: clientsRes.count || 0,
    activeClients: activeClientsRes.count || 0,
    recentLeads: recentLeadsRes.data || [],
    revenue: invoiceRevenue,
    stripeMrr,
    emailsSent: emailsSentRes.count || 0,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const statCards = [
    {
      label: "Total Leads",
      value: stats.leadCount,
      accent: "text-accent",
      bg: "bg-accent/8",
      href: "/dashboard/leads",
      indicator: "border-l-accent",
    },
    {
      label: "Active Clients",
      value: stats.activeClients,
      accent: "text-success",
      bg: "bg-success/8",
      href: "/dashboard/clients",
      indicator: "border-l-success",
    },
    {
      label: stats.stripeMrr !== null ? "Stripe MRR" : "Total Revenue",
      value: stats.stripeMrr !== null
        ? `$${stats.stripeMrr.toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo`
        : `$${stats.revenue.toLocaleString()}`,
      accent: "text-warning",
      bg: "bg-warning/8",
      href: "/dashboard/billing",
      indicator: "border-l-warning",
    },
    {
      label: "Emails Sent",
      value: stats.emailsSent,
      accent: "text-info",
      bg: "bg-info/8",
      href: "/dashboard/email",
      indicator: "border-l-info",
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">Overview of your agency operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Link key={stat.label} href={stat.href} className="stat-card rounded-xl border-l-2 border-l-transparent hover:border-l-2 group" style={{ borderLeftColor: 'transparent' }}>
            <div className={`stat-card rounded-xl group-hover:bg-card-hover`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{stat.label}</span>
                <span className={`w-2 h-2 rounded-full ${stat.bg} ${stat.accent}`} style={{ boxShadow: '0 0 6px currentColor' }} />
              </div>
              <p className={`text-[28px] font-semibold tracking-tight leading-none ${stat.accent}`}>
                {stat.value}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="text-[14px] font-semibold">Recent Leads</h3>
          <Link href="/dashboard/leads" className="text-accent text-[12px] font-medium hover:text-accent-hover transition">
            View all
          </Link>
        </div>
        <div>
          {stats.recentLeads.length === 0 ? (
            <p className="px-5 py-8 text-muted text-[13px] text-center">No leads yet</p>
          ) : (
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="font-medium text-foreground">{lead.name}</td>
                    <td>{lead.email}</td>
                    <td>
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="text-muted">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "badge-info",
    contacted: "badge-warning",
    qualified: "badge-accent",
    converted: "badge-success",
    lost: "badge-danger",
    active: "badge-success",
    paused: "badge-warning",
    churned: "badge-danger",
  };

  return (
    <span className={`badge ${styles[status] || "badge-muted"}`}>
      {status}
    </span>
  );
}
