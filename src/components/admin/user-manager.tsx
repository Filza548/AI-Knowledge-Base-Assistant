"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { selectFieldClassName } from "@/lib/field-styles";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  created_at: string;
  requested_at?: string | null;
};

function statusLabel(status?: string) {
  switch (status) {
    case "pending":
      return "Pending approval";
    case "invited":
      return "Invited";
    case "rejected":
      return "Rejected";
    case "active":
      return "Active";
    default:
      return status ?? "Unknown";
  }
}

export function UserManager({ users }: { users: UserRow[] }) {
  const t = useTranslations("UserManager");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"assistant" | "admin">("assistant");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const pending = useMemo(
    () => users.filter((u) => u.status === "pending"),
    [users],
  );
  const others = useMemo(
    () => users.filter((u) => u.status !== "pending"),
    [users],
  );

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t("createFailed"));
      setName("");
      setEmail("");
      setRole("assistant");
      if (json.inviteUrl) setInviteUrl(json.inviteUrl);
      if (json.emailSent) {
        toast.success("Invite email sent");
      } else {
        toast.message("Invite created — copy the link (email not configured)");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("createFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Approve failed");
      toast.success("User approved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: string) {
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/reject`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Reject failed");
      toast.message("Request rejected");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <Input placeholder={t("namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={10}
        />
        <select
          className={selectFieldClassName}
          value={role}
          onChange={(e) => setRole(e.target.value as "assistant" | "admin")}
        >
          <option value="assistant">{t("roleAssistant")}</option>
          <option value="admin">{t("roleAdmin")}</option>
        </select>
        <Button type="submit" disabled={loading} className="md:col-span-2">
          {loading ? t("creating") : t("createUser")}
        </Button>
      </form>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">All users</h3>
        {others.map((u) => (
          <div
            key={u.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">{u.name}</p>
              <p className="truncate text-text-secondary">{u.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="w-fit uppercase">{u.role}</Badge>
              <Badge className="w-fit">{statusLabel(u.status)}</Badge>
              {u.status === "invited" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actionId === u.id}
                  onClick={() => void reject(u.id)}
                >
                  Cancel invite
                </Button>
              ) : null}
              {u.status === "rejected" ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={actionId === u.id}
                  onClick={() => void approve(u.id)}
                >
                  Approve
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
