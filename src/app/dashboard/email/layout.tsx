"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconInbox, IconCompose, IconCampaign, IconAutomation,
  IconWarmup, IconTracking, IconContact, IconShield, IconGlobe,
} from "@/components/icons";

const EMAIL_TABS = [
  { href: "/dashboard/email", label: "Inbox", icon: IconInbox, exact: true },
  { href: "/dashboard/email/compose", label: "Compose", icon: IconCompose },
  { href: "/dashboard/email/accounts", label: "Accounts", icon: IconGlobe },
  { href: "/dashboard/email/campaigns", label: "Campaigns", icon: IconCampaign },
  { href: "/dashboard/email/automations", label: "Automations", icon: IconAutomation },
  { href: "/dashboard/email/warmup", label: "Warmup", icon: IconWarmup },
  { href: "/dashboard/email/tracking", label: "Tracking", icon: IconTracking },
  { href: "/dashboard/email/contacts", label: "Contacts", icon: IconContact },
  { href: "/dashboard/email/deliverability", label: "Deliverability", icon: IconShield },
];

export default function EmailLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Email Operations</h2>
        <p className="page-subtitle">Unified email sending, inbox management, and revenue ops</p>
      </div>

      <div className="tab-list mb-6 overflow-x-auto">
        {EMAIL_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`tab-item ${isActive ? "active" : ""}`}
            >
              <Icon size={15} />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
