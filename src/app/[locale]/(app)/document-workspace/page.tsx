import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect, Link } from "@/i18n/navigation";
import { listAccessibleDocuments } from "@/lib/documents/access";
import { DocumentWorkspace } from "@/components/document/document-workspace";
import { DocumentUploader } from "@/components/uploader/document-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DocumentWorkspacePage() {
  const [session, locale, t] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("DocumentWorkspace"),
  ]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

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
          {isAdmin ? t("descriptionAdmin") : t("descriptionAssistant")}
        </p>
      </div>

      {isAdmin ? (
        <Card id="upload">
          <CardHeader>
            <CardTitle>{t("uploadTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUploader />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-secondary">{t("assistantOnlyBody")}</p>
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/dashboard#knowledge-chat">{t("goToChat")}</Link>
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
