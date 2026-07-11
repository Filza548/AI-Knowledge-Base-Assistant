import { ChatPanel } from "@/components/chat/chat-panel";
import { SearchBar } from "@/components/search/search-bar";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500">
          Search, chat with citations, and reopen past conversations.
        </p>
      </div>
      <SearchBar />
      <ChatPanel />
    </div>
  );
}
