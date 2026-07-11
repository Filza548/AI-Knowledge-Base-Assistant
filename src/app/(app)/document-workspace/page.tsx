import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DocumentWorkspace } from "@/components/document/document-workspace";

export const dynamic = "force-dynamic";

export default async function DocumentWorkspacePage() {
  const supabase = getSupabaseAdmin();
  const { data: documents } = await supabase
    .from("knowledge_base")
    .select("id, document_name, status, file_type, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Document workspace</h1>
        <p className="text-sm text-zinc-500">
          Select a document to summarize, extract metadata, or ask scoped questions.
        </p>
      </div>
      <DocumentWorkspace documents={documents ?? []} />
    </div>
  );
}
