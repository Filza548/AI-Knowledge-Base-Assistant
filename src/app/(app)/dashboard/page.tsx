import { auth } from "@/lib/auth";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DashboardIntro } from "@/components/dashboard/dashboard-intro";
import { SearchBar } from "@/components/search/search-bar";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function DashboardPage() {
  const session = await auth();
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("knowledge_base")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready");

  if (error) throw error;

  const readyDocumentCount = count ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <DashboardIntro name={session?.user?.name} />
      <SearchBar />
      <div id="knowledge-chat">
        <ChatPanel readyDocumentCount={readyDocumentCount} />
      </div>
    </div>
  );
}
