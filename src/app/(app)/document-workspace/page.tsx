import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listAccessibleDocuments } from "@/lib/documents/access";
import { DocumentWorkspace } from "@/components/document/document-workspace";
import { DocumentUploader } from "@/components/uploader/document-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DocumentWorkspacePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const documents = await listAccessibleDocuments(session.user, { limit: 100 });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Documents
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Document Workspace</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          Upload your files, then summarize, extract metadata, or ask questions
          scoped to a document you own. Other users cannot see your uploads.
        </p>
      </div>

      <Card id="upload">
        <CardHeader>
          <CardTitle>Upload PDF / DOCX</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploader />
        </CardContent>
      </Card>

      <DocumentWorkspace
        documents={documents.map((d) => ({
          id: d.id,
          document_name: d.document_name ?? "Untitled",
          status: d.status ?? "processing",
          file_type: d.file_type ?? "pdf",
          created_at: d.created_at ?? new Date().toISOString(),
        }))}
      />
    </div>
  );
}
