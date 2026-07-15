import { auth } from "@/lib/auth";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DashboardIntro } from "@/components/dashboard/dashboard-intro";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <DashboardIntro name={session?.user?.name} />
      <div id="knowledge-chat">
        <ChatPanel />
      </div>
    </div>
  );
}
