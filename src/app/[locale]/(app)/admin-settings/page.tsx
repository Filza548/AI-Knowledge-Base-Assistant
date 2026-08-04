import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DocumentUploader } from "@/components/uploader/document-uploader";
import { DocumentAdminList } from "@/components/document/document-admin-list";
import { UserManager } from "@/components/admin/user-manager";
import { CollectionManager } from "@/components/admin/collection-manager";
import { AdminAnalytics } from "@/components/admin/admin-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [session, locale, t] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations("AdminSettings"),
  ]);
  if (!session) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (session.user.role !== "admin") {
    redirect({ href: "/dashboard", locale });
    return null;
  }

  const supabase = getSupabaseAdmin();
  const [documentsRes, usersRes, collectionsRes, linksRes] = await Promise.all([
    supabase
      .from("knowledge_base")
      .select("id, document_name, status, file_type, created_at, error_message")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("users")
      .select(
        "id, name, email, role, status, created_at, requested_at, approved_at, invite_expires_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("collections")
      .select("id, name, description, created_by, created_at, updated_at")
      .order("name", { ascending: true })
      .limit(200),
    supabase.from("collection_documents").select("collection_id, document_id"),
  ]);

  const queryError =
    documentsRes.error ?? usersRes.error ?? collectionsRes.error ?? linksRes.error;
  if (queryError) throw queryError;

  const documents = documentsRes.data;
  const users = usersRes.data;
  const collections = collectionsRes.data;
  const links = linksRes.data;

  const byCollection = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = byCollection.get(link.collection_id) ?? [];
    list.push(link.document_id);
    byCollection.set(link.collection_id, list);
  }

  const collectionsView = (collections ?? []).map((c) => ({
    ...c,
    document_ids: byCollection.get(c.id) ?? [],
    document_count: (byCollection.get(c.id) ?? []).length,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          {t("description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("analyticsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminAnalytics />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("uploadTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploader />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("manageDocumentsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentAdminList documents={documents ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("collectionsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CollectionManager
            collections={collectionsView}
            documents={(documents ?? []).map((d) => ({
              id: d.id,
              document_name: d.document_name,
              status: d.status,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("manageUsersTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <UserManager users={users ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
