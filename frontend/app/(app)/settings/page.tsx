"use client";

import { useEffect, useState } from "react";
import { buildApiUrl, clearStoredAccountId, getAccessToken } from "@/lib/api";

type UserProfile = {
  email: string;
  full_name: string;
};

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const token = getAccessToken();

  useEffect(() => {
    async function fetchUser() {
      const res = await fetch(buildApiUrl("/auth/me"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setUser(data);
      setFullName(data.full_name);
    }

    fetchUser();
  }, [token]);

  async function updateProfile() {
    await fetch(buildApiUrl("/auth/update-profile"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ full_name: fullName }),
    });

    alert("Profile updated");
  }

  async function changePassword() {
    const res = await fetch(buildApiUrl("/auth/change-password"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    if (!res.ok) {
      alert("Incorrect current password");
      return;
    }

    alert("Password updated");
    setCurrentPassword("");
    setNewPassword("");
  }

  async function deleteAccount() {
    if (!confirm("Are you sure? This cannot be undone.")) return;

    await fetch(buildApiUrl("/auth/delete-account"), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    localStorage.removeItem("access_token");
    clearStoredAccountId();
    window.location.href = "/login";
  }

  return (
    <div className="space-y-10 p-8 text-white">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Profile &amp; Settings</h1>
        <p className="text-sm text-slate-400">
          Manage your account details, sign-in security, and core SmartSpend account access.
        </p>
      </div>

      {/* Profile */}
      <div id="profile" className="scroll-mt-8 rounded-xl bg-[#0f1b33] p-6 space-y-4">
        <h2 className="text-xl font-semibold">Profile</h2>
        <div className="space-y-2">
          <label className="text-sm text-slate-400">Display Name</label>
          <input
            className="w-full rounded-lg border border-[#1f2c4d] bg-[#111c36] p-3"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-400">Email</label>
          <input
            className="w-full rounded-lg border border-[#1f2c4d] bg-[#111c36] p-3 text-slate-400"
            value={user?.email ?? ""}
            readOnly
          />
          <p className="text-sm text-slate-500">
            Your sign-in email is shown here for reference.
          </p>
        </div>

        <button
          onClick={updateProfile}
          className="rounded-lg bg-green-500 px-6 py-2 transition hover:bg-green-600"
        >
          Update Profile
        </button>
      </div>

      <div className="rounded-xl bg-[#0f1b33] p-6">
        <h2 className="text-xl font-semibold">Account Info</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[#1f2c4d] bg-[#111c36] p-4">
            <p className="text-sm text-slate-400">Primary Email</p>
            <p className="mt-2 text-lg font-semibold text-white">{user?.email ?? "Loading..."}</p>
          </div>
          <div className="rounded-lg border border-[#1f2c4d] bg-[#111c36] p-4">
            <p className="text-sm text-slate-400">Account Access</p>
            <p className="mt-2 text-lg font-semibold text-white">Active</p>
          </div>
          <div className="rounded-lg border border-[#1f2c4d] bg-[#111c36] p-4">
            <p className="text-sm text-slate-400">Sign-In Method</p>
            <p className="mt-2 text-lg font-semibold text-white">Email and password</p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div id="security" className="scroll-mt-8 rounded-xl bg-[#0f1b33] p-6 space-y-4">
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-slate-400">
          Update your password to keep your SmartSpend account secure.
        </p>
        <input
          type="password"
          placeholder="Current password"
          className="w-full rounded-lg border border-[#1f2c4d] bg-[#111c36] p-3"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="New password"
          className="w-full rounded-lg border border-[#1f2c4d] bg-[#111c36] p-3"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <button
          onClick={changePassword}
          className="rounded-lg bg-green-500 px-6 py-2 transition hover:bg-green-600"
        >
          Change Password
        </button>
      </div>

      {/* Danger Zone */}
      <div
        id="danger-zone"
        className="scroll-mt-8 rounded-xl border border-red-500/40 bg-[#1a0f18] p-6 space-y-4"
      >
        <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>
        <p className="text-sm text-red-200/80">
          Permanently delete your SmartSpend account and all associated access.
        </p>

        <button
          onClick={deleteAccount}
          className="rounded-lg bg-red-600 px-6 py-2 transition hover:bg-red-700"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
