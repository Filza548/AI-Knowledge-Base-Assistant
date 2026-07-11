import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { collectionUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireSession({
      roles: ["admin"],
      rateLimitKey: "collections-patch",
    });

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new ApiError(400, "Invalid collection id", "validation_error");
    }

    const body = await req.json();
    const parsed = collectionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input",
        "validation_error",
      );
    }

    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description;
    }

    if (Object.keys(updates).length) {
      const { error } = await supabase
        .from("collections")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    }

    if (parsed.data.documentIds) {
      const { error: delError } = await supabase
        .from("collection_documents")
        .delete()
        .eq("collection_id", id);
      if (delError) throw delError;

      if (parsed.data.documentIds.length) {
        const { error: linkError } = await supabase
          .from("collection_documents")
          .insert(
            parsed.data.documentIds.map((document_id) => ({
              collection_id: id,
              document_id,
            })),
          );
        if (linkError) throw linkError;
      }
    }

    const { data: collection, error } = await supabase
      .from("collections")
      .select("id, name, description, created_by, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!collection) {
      throw new ApiError(404, "Collection not found", "not_found");
    }

    const { data: links } = await supabase
      .from("collection_documents")
      .select("document_id")
      .eq("collection_id", id);

    const document_ids = (links ?? []).map((l) => l.document_id);

    return jsonOk({
      collection: {
        ...collection,
        document_ids,
        document_count: document_ids.length,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireSession({
      roles: ["admin"],
      rateLimitKey: "collections-delete",
    });

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new ApiError(400, "Invalid collection id", "validation_error");
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) throw error;

    return jsonOk({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
