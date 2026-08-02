"use client";

import { FormEvent, useState } from "react";
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
  created_at: string;
};

export function UserManager({ users }: { users: UserRow[] }) {
  const t = useTranslations("UserManager");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"assistant" | "admin">("assistant");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t("createFailed"));
      setName("");
      setEmail("");
      setPassword("");
      setRole("assistant");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("createFailed"));
    } finally {
      setLoading(false);
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
        {users.map((u) => (
          <div
            key={u.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">{u.name}</p>
              <p className="truncate text-text-secondary">{u.email}</p>
            </div>
            <Badge className="w-fit uppercase">{u.role}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
