"use client";

import { useState, useEffect } from "react";

const CURRENCIES = [
  { code: "CAD", label: "CAD — Canadian Dollar", symbol: "C$" },
  { code: "USD", label: "USD — US Dollar", symbol: "$" },
  { code: "EUR", label: "EUR — Euro", symbol: "€" },
  { code: "GBP", label: "GBP — British Pound", symbol: "£" },
  { code: "AUD", label: "AUD — Australian Dollar", symbol: "A$" },
  { code: "NZD", label: "NZD — New Zealand Dollar", symbol: "NZ$" },
  { code: "CHF", label: "CHF — Swiss Franc", symbol: "Fr" },
  { code: "JPY", label: "JPY — Japanese Yen", symbol: "¥" },
  { code: "MXN", label: "MXN — Mexican Peso", symbol: "MX$" },
];

interface RecentCharge {
  id: string;
  amount: number;
  nativeAmount: number;
  nativeCurrency: string;
  currency: string;
  status: string;
  description: string | null;
  customerEmail: string | null;
  customerName: string | null;
  createdAt: string;
  receiptUrl: string | null;
}

interface StripeRevenue {
  configured: boolean;
  message?: string;
  revenue30d: number;
  revenue90d: number;
  mrr: number;
  available: number;
  accountCurrency: string;
  currency: string;
  exchangeRate: number;
  subscriptionCount: number;
  recentCharges: RecentCharge[];
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "succeeded"
      ? "badge-success"
      : status === "pending"
      ? "badge-warning"
      : "badge-danger";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function BillingPage() {
  const [data, setData] = useState<StripeRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [rateLoading, setRateLoading] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState("CAD");
  const [initialized, setInitialized] = useState(false);

  // Initial load — fetch with no currency param, use whatever the account currency is
  useEffect(() => {
    fetch("/api/stripe/revenue")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
        if (d?.currency) {
          setDisplayCurrency(d.currency.toUpperCase());
        }
        setInitialized(true);
      })
      .catch(() => setLoading(false));
  }, []);

  // Re-fetch with requested currency once initialized and user changes selection
  useEffect(() => {
    if (!initialized) return;
    setRateLoading(true);
    fetch(`/api/stripe/revenue?currency=${displayCurrency}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setRateLoading(false));
  }, [displayCurrency, initialized]);

  const sym = CURRENCIES.find((c) => c.code === displayCurrency)?.symbol ?? displayCurrency;

  function fmt(amount: number) {
    const decimals = displayCurrency === "JPY" ? 0 : 2;
    return `${sym}${amount.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h2 className="page-title">Billing & Revenue</h2>
          <p className="page-subtitle">Stripe payment tracking</p>
        </div>
        <p className="text-center text-muted py-16 text-[13px]">Loading Stripe data…</p>
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div>
        <div className="page-header">
          <h2 className="page-title">Billing & Revenue</h2>
          <p className="page-subtitle">Stripe payment tracking</p>
        </div>
        <div className="panel max-w-xl">
          <div className="panel-body space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-lg">⚡</div>
              <div>
                <p className="text-[14px] font-semibold">Connect Stripe</p>
                <p className="text-[12px] text-muted">Add your keys to start tracking revenue</p>
              </div>
            </div>
            {data?.message && (
              <div className="rounded-lg bg-danger/8 border border-danger/20 px-4 py-2.5 text-[12px] text-danger">
                {data.message}
              </div>
            )}
            <ol className="space-y-3 text-[13px] text-muted">
              <li className="flex gap-2.5">
                <span className="text-accent font-semibold shrink-0">1.</span>
                Go to{" "}
                <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-accent underline">
                  dashboard.stripe.com/apikeys
                </a>{" "}
                and copy your <strong className="text-foreground">Secret Key</strong>.
              </li>
              <li className="flex gap-2.5">
                <span className="text-accent font-semibold shrink-0">2.</span>
                Add to <code className="text-foreground bg-card-hover px-1.5 py-0.5 rounded">.env</code>:
                <br />
                <code className="text-foreground bg-card-hover px-2 py-1.5 rounded text-[11px] block mt-1.5 leading-relaxed">
                  STRIPE_SECRET_KEY=&quot;sk_live_...&quot;
                  <br />
                  STRIPE_PUBLISHABLE_KEY=&quot;pk_live_...&quot;
                  <br />
                  STRIPE_WEBHOOK_SECRET=&quot;whsec_...&quot;
                </code>
              </li>
              <li className="flex gap-2.5">
                <span className="text-accent font-semibold shrink-0">3.</span>
                Restart the dev server. Revenue data will appear here.
              </li>
              <li className="flex gap-2.5">
                <span className="text-accent font-semibold shrink-0">4.</span>
                <span>
                  For webhooks (auto-mark invoices paid), add{" "}
                  <code className="text-foreground bg-card-hover px-1.5 py-0.5 rounded">/api/webhooks/stripe</code>{" "}
                  as a Stripe webhook endpoint listening for{" "}
                  <code className="text-foreground bg-card-hover px-1.5 py-0.5 rounded">checkout.session.completed</code>.
                </span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Revenue (30 days)", value: fmt(data.revenue30d), color: "text-success", bg: "bg-success/8" },
    { label: "Revenue (90 days)", value: fmt(data.revenue90d), color: "text-accent", bg: "bg-accent/8" },
    { label: "MRR (Subscriptions)", value: fmt(data.mrr), color: "text-warning", bg: "bg-warning/8" },
    { label: "Stripe Balance", value: fmt(data.available), color: "text-info", bg: "bg-info/8" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between page-header">
        <div>
          <h2 className="page-title">Billing & Revenue</h2>
          <p className="page-subtitle">
            {data.subscriptionCount} active subscription{data.subscriptionCount !== 1 ? "s" : ""} · Live Stripe data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
              className="input-field pr-8 text-[13px] cursor-pointer"
              style={{ minWidth: 180 }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          {displayCurrency !== (data.accountCurrency ?? data.currency).toUpperCase() && !rateLoading && data.exchangeRate && (
            <span className="text-[11px] text-muted whitespace-nowrap">
              1 {(data.accountCurrency ?? data.currency).toUpperCase()} = {data.exchangeRate.toFixed(4)} {displayCurrency}
            </span>
          )}
          {rateLoading && (
            <span className="text-[11px] text-muted whitespace-nowrap animate-pulse">fetching rate…</span>
          )}
          <a
            href="https://dashboard.stripe.com/payments"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-[12px]"
          >
            Open Stripe ↗
          </a>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className={`stat-card rounded-xl`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{s.label}</span>
              <span className={`w-2 h-2 rounded-full ${s.bg} ${s.color}`} style={{ boxShadow: "0 0 6px currentColor" }} />
            </div>
            <p className={`text-[26px] font-semibold tracking-tight leading-none ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="text-[14px] font-semibold">Recent Transactions (30 days)</h3>
          <span className="text-[12px] text-muted">{data.recentCharges.length} shown</span>
        </div>
        {data.recentCharges.length === 0 ? (
          <p className="px-5 py-12 text-center text-muted text-[13px]">No transactions in the last 30 days</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCharges.map((charge) => (
                  <tr key={charge.id}>
                    <td>
                      <p className="font-medium text-foreground">{charge.customerName || "—"}</p>
                      <p className="text-[11px] text-muted">{charge.customerEmail || charge.id.slice(0, 14) + "…"}</p>
                    </td>
                    <td className="text-[12px] text-muted max-w-[180px]">
                      <span className="truncate block" title={charge.description ?? ""}>{charge.description || "—"}</span>
                    </td>
                    <td className="font-mono font-medium text-foreground">
                      {fmt(charge.amount)}
                      {charge.nativeCurrency !== displayCurrency && (
                        <span className="text-[10px] text-muted ml-1">({charge.nativeCurrency} {charge.nativeAmount.toFixed(2)})</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={charge.status} />
                    </td>
                    <td className="text-muted text-[12px]">
                      {new Date(charge.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      {charge.receiptUrl ? (
                        <a
                          href={charge.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent text-[12px] hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-muted text-[12px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Setup info */}
      <div className="mt-4 panel">
        <div className="panel-body">
          <p className="text-[12px] text-muted font-medium mb-2">Webhook endpoint (auto-marks invoices paid)</p>
          <code className="text-[11px] text-foreground bg-card-hover px-3 py-2 rounded block">
            {process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com"}/api/webhooks/stripe
          </code>
          <p className="text-[11px] text-muted mt-2">
            Add this URL in{" "}
            <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Stripe → Developers → Webhooks
            </a>{" "}
            and select <code className="bg-card-hover px-1 rounded">checkout.session.completed</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
