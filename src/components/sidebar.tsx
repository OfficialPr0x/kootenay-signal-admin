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
  IconSignal,
} from "@/components/icons";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/dashboard/leads", label: "Leads", icon: IconLeads },
  { href: "/dashboard/clients", label: "Clients", icon: IconClients },
  { href: "/dashboard/invoices", label: "Invoices", icon: IconInvoices },
  { href: "/dashboard/email", label: "Email", icon: IconEmail },
  { href: "/dashboard/services", label: "Services", icon: IconServices },
  { href: "/dashboard/settings", label: "Settings", icon: IconSettings },
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
    <aside className="w-[260px] bg-card border-r border-border flex flex-col shrink-0 h-screen">
      <div className="px-6 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <IconSignal size={16} className="text-accent" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight leading-none">
              <span className="text-accent">KOOTENAY</span>{" "}
              <span className="text-foreground">SIGNAL</span>
            </h1>
            <p className="text-[10px] text-muted mt-0.5 tracking-widest uppercase">Admin</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 py-2 text-[10px] font-medium text-muted tracking-widest uppercase">Menu</p>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-card-hover"
              }`}
            >
              <Icon
                size={18}
                className={
                  isActive
                    ? "text-accent"
                    : "text-muted group-hover:text-muted-foreground transition-colors"
                }
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate leading-tight">{user.name}</p>
            <p className="text-[11px] text-muted truncate leading-tight mt-0.5">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-muted hover:text-danger hover:bg-danger-dim rounded-lg transition cursor-pointer"
        >
          <IconLogout size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
