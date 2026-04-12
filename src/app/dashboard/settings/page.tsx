"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
        setLoading(false);
      });
  }, []);

  async function handleUpdateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setMessage("Profile updated successfully");
      const updated = await res.json();
      setUser(updated);
      router.refresh();
    } else {
      const err = await res.json();
      setMessage(err.error || "Failed to update");
    }

    setSaving(false);
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    if (newPassword !== confirmPassword) {
      setMessage("Passwords don't match");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setMessage("Password changed successfully");
      e.currentTarget.reset();
    } else {
      const err = await res.json();
      setMessage(err.error || "Failed to change password");
    }

    setSaving(false);
  }

  if (loading) return <p className="text-muted">Loading...</p>;

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted text-sm mt-1">Manage your account and preferences</p>
      </div>

      {message && (
        <div className="mb-6 px-4 py-3 rounded-lg text-sm border bg-accent/10 text-accent border-accent/20">
          {message}
        </div>
      )}

      <div className="grid gap-6 max-w-2xl">
        {/* Profile */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Profile</h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Name</label>
              <input name="name" defaultValue={user?.name}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Email</label>
              <input name="email" type="email" defaultValue={user?.email}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
            </div>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50 cursor-pointer">
              Save Changes
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Current Password</label>
              <input name="currentPassword" type="password" required
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">New Password</label>
              <input name="newPassword" type="password" required minLength={8}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Confirm New Password</label>
              <input name="confirmPassword" type="password" required minLength={8}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
            </div>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50 cursor-pointer">
              Change Password
            </button>
          </form>
        </div>

        {/* Environment Info */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Environment</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Resend API Key</span>
              <span className={process.env.NEXT_PUBLIC_HAS_RESEND_KEY === "true" ? "text-success" : "text-warning"}>
                {process.env.NEXT_PUBLIC_HAS_RESEND_KEY === "true" ? "Configured" : "Not configured"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Database</span>
              <span className="text-success">SQLite (Active)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
