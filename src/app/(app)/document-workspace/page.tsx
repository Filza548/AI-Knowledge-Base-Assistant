import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DocumentWorkspace } from "@/components/document/document-workspace";

export const dynamic = "force-dynamic";

export default async function DocumentWorkspacePage() {
  const supabase = getSupabaseAdmin();
  const { data: documents, error } = await supabase
    .from("knowledge_base")
    .select("id, document_name, status, file_type, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Documents
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Document Workspace</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          Browse indexed files from the knowledge base. Summarize a policy,
          extract structured metadata, or ask questions scoped to a single
          document — answers still include citations when sources exist.
        </p>
      </div>
      <DocumentWorkspace documents={documents ?? []} />
    </div>
  );
}
