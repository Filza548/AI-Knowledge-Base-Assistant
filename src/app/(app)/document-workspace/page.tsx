import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listAccessibleDocuments } from "@/lib/documents/access";
import { DocumentWorkspace } from "@/components/document/document-workspace";
import { DocumentUploader } from "@/components/uploader/document-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DocumentWorkspacePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isAdmin = session.user.role === "admin";
  const documents = await listAccessibleDocuments(session.user, { limit: 100 });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Documents
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Document Workspace</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          {isAdmin
            ? "Upload company PDFs/DOCX here or in Admin Settings. Indexed documents become available to every signed-in user for search and chat."
            : "Browse the company knowledge base uploaded by admins. Summarize a file, extract metadata, or ask questions about it — you cannot upload or delete documents."}
        </p>
      </div>

      {isAdmin ? (
        <Card id="upload">
          <CardHeader>
            <CardTitle>Upload PDF / DOCX</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUploader />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-secondary">
              Only admins can add documents. Ask questions from the Dashboard
              chat once files are indexed.
            </p>
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/dashboard#knowledge-chat">Go to chat</Link>
            </Button>
          </CardContent>
        </Card>
      )}

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
