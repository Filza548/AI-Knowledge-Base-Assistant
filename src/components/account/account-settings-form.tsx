"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  name: string;
  email: string;
  role: string;
  hasPassword: boolean;
};

export function AccountSettingsForm({
  name: initialName,
  email,
  role,
  hasPassword: initialHasPassword,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const nameChanged = trimmedName !== initialName.trim();
    const changingPassword = Boolean(newPassword || confirmPassword);

    if (!nameChanged && !changingPassword) {
      setError("Change your name or password to save.");
      return;
    }

    if (changingPassword) {
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
      if (hasPassword && !currentPassword) {
        setError("Enter your current password to change it.");
        return;
      }
    }

    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (nameChanged) body.name = trimmedName;
      if (changingPassword) {
        body.newPassword = newPassword;
        if (hasPassword) body.currentPassword = currentPassword;
      }

      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Update failed");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (json.user?.hasPassword) setHasPassword(true);
      toast.success("Profile updated");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="email">
          Email
        </label>
        <Input id="email" type="email" value={email} disabled readOnly />
        <p className="text-xs text-text-secondary">
          Email cannot be changed. Contact an admin if you need a different
          address.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="role">
          Role
        </label>
        <Input id="role" value={role} disabled readOnly className="capitalize" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="name">
          Display name
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={1}
          maxLength={120}
          autoComplete="name"
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Password</h3>
          <p className="text-xs text-text-secondary">
            {hasPassword
              ? "Enter your current password to set a new one."
              : "No password yet (Google sign-in). You can set one here for email login."}
          </p>
        </div>
        {hasPassword ? (
          <Input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        ) : null}
        <Input
          type="password"
          placeholder="New password (min 10, mixed case + number)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={10}
          autoComplete="new-password"
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={10}
          autoComplete="new-password"
        />
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
