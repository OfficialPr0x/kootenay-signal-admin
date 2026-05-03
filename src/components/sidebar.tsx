"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconDashboard,
  IconLeads,
  IconClients,
  IconInvoices,
  IconEmail,
  IconServices,
  IconSettings,
  IconLogout,
  IconBilling,
  IconPipeline,
  IconAds,
} from "@/components/icons";

const navItems = [
  { href: "/dashboard",          label: "Dashboard", icon: IconDashboard },
  { href: "/dashboard/leads",    label: "Leads",     icon: IconLeads },
  { href: "/dashboard/pipeline", label: "Pipeline",  icon: IconPipeline },
  { href: "/dashboard/clients",  label: "Clients",   icon: IconClients },
  { href: "/dashboard/invoices", label: "Invoices",  icon: IconInvoices },
  { href: "/dashboard/billing",  label: "Billing",   icon: IconBilling },
  { href: "/dashboard/email",    label: "Email",     icon: IconEmail },
  { href: "/dashboard/ads",      label: "Ad Creatives", icon: IconAds },
  { href: "/dashboard/services", label: "Services",     icon: IconServices },
  { href: "/dashboard/settings", label: "Settings",     icon: IconSettings },
];

interface SidebarProps {
  user: { id: string; email: string; name: string; role: string };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      {/* ── Brand Header ── */}
      <div className="sidebar-header">
        <Link href="/dashboard" className="sidebar-logo-link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://res.cloudinary.com/doajstql7/image/upload/q_auto/f_auto/v1777003162/f3d21215-ada9-4ea3-b86d-510a6885c8f5-removebg-preview_uat1ay.png"
            alt="Kootenay Signal"
            className="sidebar-logo-img"
          />
        </Link>
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
            >
              <span className="sidebar-nav-icon">
                <Icon size={16} />
              </span>
              {item.label}
              {isActive && <span className="sidebar-active-dot" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Agency Card ── */}
      <div className="sidebar-agency-card">
        <div className="sidebar-agency-status">
          <span className="sidebar-agency-dot" />
          <span className="sidebar-agency-label">Kootenay Signal</span>
        </div>
        <p className="sidebar-agency-sub">Agency Admin · v1.0</p>
      </div>

      {/* ── User Footer ── */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user.name}</p>
            <p className="sidebar-user-email">{user.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="sidebar-logout" title="Sign Out">
          <IconLogout size={15} />
        </button>
      </div>
    </aside>
  );
}
