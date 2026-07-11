import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { collectionCreateSchema } from "@/lib/validations";

export async function GET() {
  try {
    await requireSession({ rateLimitKey: "collections-list" });
    const supabase = getSupabaseAdmin();
    const { data: collections, error } = await supabase
      .from("collections")
      .select("id, name, description, created_by, created_at, updated_at")
      .order("name", { ascending: true });

    if (error) throw error;

    const ids = (collections ?? []).map((c) => c.id);
    let links: { collection_id: string; document_id: string }[] = [];
    if (ids.length) {
      const { data, error: linkError } = await supabase
        .from("collection_documents")
        .select("collection_id, document_id")
        .in("collection_id", ids);
      if (linkError) throw linkError;
      links = data ?? [];
    }

    const byCollection = new Map<string, string[]>();
    for (const link of links) {
      const list = byCollection.get(link.collection_id) ?? [];
      list.push(link.document_id);
      byCollection.set(link.collection_id, list);
    }

    return jsonOk({
      collections: (collections ?? []).map((c) => ({
        ...c,
        document_ids: byCollection.get(c.id) ?? [],
        document_count: (byCollection.get(c.id) ?? []).length,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession({
      roles: ["admin"],
      rateLimitKey: "collections-create",
      limit: 20,
    });

    const body = await req.json();
    const parsed = collectionCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
        "validation_error",
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: collection, error } = await supabase
      .from("collections")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        created_by: session.user.id,
      })
      .select("id, name, description, created_by, created_at, updated_at")
      .single();

    if (error) throw error;

    const documentIds = parsed.data.documentIds ?? [];
    if (documentIds.length) {
      const { error: linkError } = await supabase
        .from("collection_documents")
        .insert(
          documentIds.map((document_id) => ({
            collection_id: collection.id,
            document_id,
          })),
        );
      if (linkError) throw linkError;
    }

    return jsonOk(
      {
        collection: {
          ...collection,
          document_ids: documentIds,
          document_count: documentIds.length,
        },
      },
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
