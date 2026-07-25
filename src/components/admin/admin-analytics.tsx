"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Analytics = {
  stats: {
    queriesToday: number;
    queries7d: number;
    unanswered7d: number;
    activeUsers7d: number;
    adminActions7d: number;
    assistantActions7d: number;
    chatShare: number;
  };
  topQueries: { query: string; count: number }[];
  topDocuments: { id: string; name: string; count: number }[];
  recentUnanswered: {
    query: string;
    timestamp: string;
    source: string | null;
    user_role?: string | null;
    user_email?: string | null;
  }[];
  recentActivity: {
    action: string;
    user_role: string;
    user_email: string | null;
    details: Record<string, unknown>;
    created_at: string;
  }[];
};

export function AdminAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Failed to load analytics");
        setData(json);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load analytics"),
      );
  }, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <p className="text-sm text-text-secondary">Loading analytics…</p>;

  const { stats } = data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Queries today" value={String(stats.queriesToday)} />
        <Stat label="Queries (7d)" value={String(stats.queries7d)} />
        <Stat label="Unanswered (7d)" value={String(stats.unanswered7d)} />
        <Stat label="Active users (7d)" value={String(stats.activeUsers7d)} />
        <Stat label="Admin actions (7d)" value={String(stats.adminActions7d ?? 0)} />
        <Stat
          label="Assistant actions (7d)"
          value={String(stats.assistantActions7d ?? 0)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top queries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topQueries.map((q) => (
              <div
                key={q.query}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-foreground">{q.query}</span>
                <Badge>{q.count}</Badge>
              </div>
            ))}
            {!data.topQueries.length ? (
              <p className="text-sm text-text-secondary">No queries yet.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most cited documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topDocuments.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-foreground">{d.name}</span>
                <Badge>{d.count}</Badge>
              </div>
            ))}
            {!data.topDocuments.length ? (
              <p className="text-sm text-text-secondary">No citations yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity by role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data.recentActivity ?? []).map((a) => (
            <div
              key={`${a.created_at}-${a.action}-${a.user_email}`}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {a.action}
                  {a.user_email ? ` · ${a.user_email}` : ""}
                </p>
                <p className="text-xs text-text-secondary">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
              <Badge className="uppercase">{a.user_role}</Badge>
            </div>
          ))}
          {!(data.recentActivity ?? []).length ? (
            <p className="text-sm text-text-secondary">No activity yet.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent unanswered</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentUnanswered.map((r, i) => (
            <div key={`${r.timestamp}-${i}`} className="text-sm">
              <p className="font-medium text-foreground">{r.query}</p>
              <p className="text-xs text-text-secondary">
                {new Date(r.timestamp).toLocaleString()}
                {r.source ? ` · ${r.source}` : ""}
                {r.user_role ? ` · ${r.user_role}` : ""}
                {r.user_email ? ` · ${r.user_email}` : ""}
              </p>
            </div>
          ))}
          {!data.recentUnanswered.length ? (
            <p className="text-sm text-text-secondary">
              No unanswered queries in the last 7 days.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}
