"use client";

import { useEffect, useState } from "react";
import { buildApiUrl, clearStoredAccountId, getAccessToken } from "@/lib/api";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
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
  }, []);

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
    <div className="p-8 space-y-10 text-white">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Profile */}
      <div id="profile" className="scroll-mt-8 bg-[#0f1b33] p-6 rounded-xl space-y-4">
        <h2 className="text-xl font-semibold">Profile</h2>

        <input
          className="w-full bg-[#111c36] border border-[#1f2c4d] p-3 rounded-lg"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <button
          onClick={updateProfile}
          className="bg-green-500 px-6 py-2 rounded-lg"
        >
          Update Profile
        </button>
      </div>

      {/* Change Password */}
      <div id="security" className="scroll-mt-8 bg-[#0f1b33] p-6 rounded-xl space-y-4">
        <h2 className="text-xl font-semibold">Change Password</h2>

        <input
          type="password"
          placeholder="Current password"
          className="w-full bg-[#111c36] border border-[#1f2c4d] p-3 rounded-lg"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="New password"
          className="w-full bg-[#111c36] border border-[#1f2c4d] p-3 rounded-lg"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <button
          onClick={changePassword}
          className="bg-green-500 px-6 py-2 rounded-lg"
        >
          Change Password
        </button>
      </div>

      {/* Danger Zone */}
      <div
        id="danger-zone"
        className="scroll-mt-8 bg-[#1a0f18] p-6 rounded-xl space-y-4 border border-red-500/40"
      >
        <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>

        <button
          onClick={deleteAccount}
          className="bg-red-600 px-6 py-2 rounded-lg"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
