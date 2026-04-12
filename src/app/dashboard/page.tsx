import { prisma } from "@/lib/db";
import Link from "next/link";

async function getStats() {
  const [leadCount, clientCount, activeClients, recentLeads, revenue, emailsSent] =
    await Promise.all([
      prisma.lead.count(),
      prisma.client.count(),
      prisma.client.count({ where: { status: "active" } }),
      prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.invoice.aggregate({
        where: { status: "paid" },
        _sum: { amount: true },
      }),
      prisma.emailLog.count(),
    ]);

  return { leadCount, clientCount, activeClients, recentLeads, revenue: revenue._sum.amount || 0, emailsSent };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const statCards = [
    { label: "Total Leads", value: stats.leadCount, color: "text-accent", href: "/dashboard/leads" },
    { label: "Active Clients", value: stats.activeClients, color: "text-success", href: "/dashboard/clients" },
    { label: "Total Revenue", value: `$${stats.revenue.toLocaleString()}`, color: "text-warning", href: "/dashboard/invoices" },
    { label: "Emails Sent", value: stats.emailsSent, color: "text-blue-400", href: "/dashboard/email" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted text-sm mt-1">Overview of your agency operations</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-card border border-border rounded-xl p-6 hover:border-accent/30 transition group"
          >
            <p className="text-muted text-sm">{stat.label}</p>
            <p className={`text-3xl font-bold mt-2 ${stat.color} group-hover:opacity-80 transition`}>
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Recent leads */}
      <div className="bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="font-semibold">Recent Leads</h3>
          <Link href="/dashboard/leads" className="text-accent text-sm hover:underline">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {stats.recentLeads.length === 0 ? (
            <p className="p-6 text-muted text-sm">No leads yet</p>
          ) : (
            stats.recentLeads.map((lead) => (
              <div key={lead.id} className="p-4 px-6 flex items-center justify-between">
                <div>
                  <p className="font-medium">{lead.name}</p>
                  <p className="text-muted text-sm">{lead.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={lead.status} />
                  <span className="text-muted text-xs">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    contacted: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    qualified: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    converted: "bg-green-500/10 text-green-400 border-green-500/20",
    lost: "bg-red-500/10 text-red-400 border-red-500/20",
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    paused: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    churned: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
        colors[status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"
      }`}
    >
      {status}
    </span>
  );
}
