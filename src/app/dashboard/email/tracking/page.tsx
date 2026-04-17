"use client";

import { useState, useEffect, useCallback } from "react";
import { IconTrendUp, IconRefresh, IconBarChart } from "@/components/icons";

interface TrackingStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  complained: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

interface TopSubject {
  subject: string;
  sent: number;
  opens: number;
  clicks: number;
  replies: number;
  openRate: number;
}

interface MailboxPerformance {
  email: string;
  sent: number;
  bounceRate: number;
  replyRate: number;
  trustScore: number;
}

interface DailyVolume {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
}

export default function TrackingPage() {
  const [stats, setStats] = useState<TrackingStats | null>(null);
  const [topSubjects, setTopSubjects] = useState<TopSubject[]>([]);
  const [mailboxPerf, setMailboxPerf] = useState<MailboxPerformance[]>([]);
  const [dailyVolume, setDailyVolume] = useState<DailyVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7d");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tracking?period=${period}`);
      const data = await res.json();
      setStats(data.stats || null);
      setTopSubjects(data.topSubjects || []);
      setMailboxPerf(data.mailboxPerformance || []);
      setDailyVolume(data.dailyVolume || []);
    } catch { /* empty */ }
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function getScoreColor(value: number, thresholds: { good: number; warn: number; invert?: boolean }) {
    if (thresholds.invert) {
      if (value <= thresholds.good) return "text-success";
      if (value <= thresholds.warn) return "text-warning";
      return "text-danger";
    }
    if (value >= thresholds.good) return "text-success";
    if (value >= thresholds.warn) return "text-warning";
    return "text-danger";
  }

  if (loading) {
    return <div className="panel p-8 text-center text-muted text-[13px]">Loading tracking data...</div>;
  }

  return (
    <div>
      {/* Period selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {[
            { value: "24h", label: "24 Hours" },
            { value: "7d", label: "7 Days" },
            { value: "30d", label: "30 Days" },
            { value: "90d", label: "90 Days" },
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`text-[11px] px-3 py-1.5 rounded-md transition cursor-pointer ${
                period === p.value ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={() => fetchData()} className="btn-ghost !text-[11px] cursor-pointer"><IconRefresh size={12} /> Refresh</button>
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-muted uppercase tracking-wider">Sent</span>
          </div>
          <p className="text-[28px] font-semibold text-foreground">{stats?.sent || 0}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-muted uppercase tracking-wider">Delivered</span>
          </div>
          <p className="text-[28px] font-semibold text-success">{stats?.delivered || 0}</p>
          <p className="text-[11px] text-muted mt-1">{stats?.sent ? Math.round((stats.delivered / stats.sent) * 100) : 0}% delivery rate</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-muted uppercase tracking-wider">Opened</span>
          </div>
          <p className={`text-[28px] font-semibold ${getScoreColor(stats?.openRate || 0, { good: 30, warn: 15 })}`}>
            {stats?.opened || 0}
          </p>
          <p className="text-[11px] text-muted mt-1">{(stats?.openRate || 0).toFixed(1)}% open rate</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-muted uppercase tracking-wider">Replied</span>
          </div>
          <p className={`text-[28px] font-semibold ${getScoreColor(stats?.replyRate || 0, { good: 10, warn: 3 })}`}>
            {stats?.replied || 0}
          </p>
          <p className="text-[11px] text-muted mt-1">{(stats?.replyRate || 0).toFixed(1)}% reply rate</p>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Clicked</span>
          <p className="text-[20px] font-semibold text-info mt-1">{stats?.clicked || 0}</p>
          <p className="text-[11px] text-muted mt-0.5">{(stats?.clickRate || 0).toFixed(1)}%</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Bounced</span>
          <p className={`text-[20px] font-semibold mt-1 ${getScoreColor(stats?.bounceRate || 0, { good: 2, warn: 5, invert: true })}`}>
            {stats?.bounced || 0}
          </p>
          <p className="text-[11px] text-muted mt-0.5">{(stats?.bounceRate || 0).toFixed(1)}%</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Unsubscribed</span>
          <p className="text-[20px] font-semibold text-warning mt-1">{stats?.unsubscribed || 0}</p>
        </div>
        <div className="stat-card">
          <span className="text-[10px] text-muted uppercase tracking-wider">Spam Complaints</span>
          <p className={`text-[20px] font-semibold mt-1 ${(stats?.complained || 0) > 0 ? "text-danger" : "text-foreground"}`}>
            {stats?.complained || 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Daily Volume Chart (text-based) */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Daily Volume</h3>
          </div>
          <div className="panel-body">
            {dailyVolume.length === 0 ? (
              <p className="text-[13px] text-muted text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-2">
                {dailyVolume.map(d => {
                  const maxSent = Math.max(...dailyVolume.map(v => v.sent), 1);
                  const pct = (d.sent / maxSent) * 100;
                  return (
                    <div key={d.date} className="flex items-center gap-3">
                      <span className="text-[11px] text-muted w-16 shrink-0">{new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      <div className="flex-1 h-5 bg-card-elevated rounded overflow-hidden relative">
                        <div className="h-full bg-accent/20 rounded" style={{ width: `${pct}%` }} />
                        <div className="absolute inset-y-0 left-2 flex items-center">
                          <span className="text-[10px] font-medium text-foreground">{d.sent}</span>
                        </div>
                      </div>
                      {d.bounced > 0 && (
                        <span className="text-[10px] text-danger">{d.bounced} bounced</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top Subject Lines */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="text-[14px] font-semibold">Top Subject Lines</h3>
          </div>
          {topSubjects.length === 0 ? (
            <div className="p-6 text-center text-muted text-[13px]">No data yet</div>
          ) : (
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Sent</th>
                  <th>Open %</th>
                  <th>Replies</th>
                </tr>
              </thead>
              <tbody>
                {topSubjects.map((s, i) => (
                  <tr key={i}>
                    <td className="text-foreground max-w-[200px] truncate">{s.subject}</td>
                    <td>{s.sent}</td>
                    <td className={getScoreColor(s.openRate, { good: 30, warn: 15 })}>{s.openRate.toFixed(0)}%</td>
                    <td>{s.replies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Mailbox Performance */}
      <div className="panel mt-4">
        <div className="panel-header">
          <h3 className="text-[14px] font-semibold">Mailbox Performance</h3>
        </div>
        {mailboxPerf.length === 0 ? (
          <div className="p-6 text-center text-muted text-[13px]">No mailbox data</div>
        ) : (
          <table className="brand-table">
            <thead>
              <tr>
                <th>Mailbox</th>
                <th>Sent</th>
                <th>Bounce Rate</th>
                <th>Reply Rate</th>
                <th>Trust Score</th>
              </tr>
            </thead>
            <tbody>
              {mailboxPerf.map((m, i) => (
                <tr key={i}>
                  <td className="text-foreground font-medium">{m.email}</td>
                  <td>{m.sent}</td>
                  <td className={getScoreColor(m.bounceRate, { good: 2, warn: 5, invert: true })}>{m.bounceRate.toFixed(1)}%</td>
                  <td className={getScoreColor(m.replyRate, { good: 10, warn: 3 })}>{m.replyRate.toFixed(1)}%</td>
                  <td>
                    <span className={`font-semibold ${getScoreColor(m.trustScore, { good: 80, warn: 60 })}`}>{m.trustScore.toFixed(0)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
