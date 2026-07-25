export default function AppLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-pulse p-1">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-surface-muted" />
        <div className="h-8 w-64 rounded bg-surface-muted" />
        <div className="h-4 w-full max-w-xl rounded bg-surface-muted" />
      </div>
      <div className="h-[28rem] rounded-2xl border border-border bg-surface-muted/40" />
    </div>
  );
}
