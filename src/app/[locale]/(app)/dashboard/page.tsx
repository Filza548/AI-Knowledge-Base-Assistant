import { auth } from "@/lib/auth";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DashboardIntro } from "@/components/dashboard/dashboard-intro";
import { SearchBar } from "@/components/search/search-bar";
import { getAccessibleDocumentIds } from "@/lib/documents/access";

export default async function DashboardPage() {
  const session = await auth();
  const readyIds = session?.user?.id
    ? await getAccessibleDocumentIds(session.user, { readyOnly: true })
    : [];

  const readyDocumentCount = readyIds.length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
      <DashboardIntro
        name={session?.user?.name}
        role={session?.user?.role}
      />
      <SearchBar />
      <div id="knowledge-chat">
        <ChatPanel readyDocumentCount={readyDocumentCount} />
      </div>
    </div>
  );
}
