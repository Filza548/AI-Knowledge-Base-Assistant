import { getTranslations } from "next-intl/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DocumentWorkspace } from "@/components/document/document-workspace";
import { DocumentUploader } from "@/components/uploader/document-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DocumentWorkspacePage() {
  const supabase = getSupabaseAdmin();
  const t = await getTranslations("DocumentWorkspace");
  const { data: documents, error } = await supabase
    .from("knowledge_base")
    .select("id, document_name, status, file_type, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const isAdmin = session.user.role === "admin";
  const documents = await listAccessibleDocuments(session.user, { limit: 100 });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          {t("description")}
        </p>
      </div>

      <Card id="upload">
        <CardHeader>
          <CardTitle>{t("uploadTitle")}</CardTitle>
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
