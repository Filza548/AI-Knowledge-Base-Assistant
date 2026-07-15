import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DocumentUploader } from "@/components/uploader/document-uploader";
import { DocumentAdminList } from "@/components/document/document-admin-list";
import { UserManager } from "@/components/admin/user-manager";
import { CollectionManager } from "@/components/admin/collection-manager";
import { AdminAnalytics } from "@/components/admin/admin-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const supabase = getSupabaseAdmin();
  const [{ data: documents }, { data: users }, { data: collections }, { data: links }] =
    await Promise.all([
      supabase
        .from("knowledge_base")
        .select("id, document_name, status, file_type, created_at, error_message")
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("id, name, email, role, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("collections")
        .select("id, name, description, created_by, created_at, updated_at")
        .order("name", { ascending: true }),
      supabase.from("collection_documents").select("collection_id, document_id"),
    ]);

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
          Administration
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Admin Settings</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          Keep the knowledge base healthy: upload and reindex PDFs/DOCX, organize
          collections, provision viewers and admins, and review usage analytics.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminAnalytics />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload PDF / DOCX</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploader />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentAdminList documents={documents ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
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
          <CardTitle>Manage users</CardTitle>
        </CardHeader>
        <CardContent>
          <UserManager users={users ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
