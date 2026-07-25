import { handleRouteError, jsonOk, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { summarizeDocument } from "@/lib/openai/rag";
import { requireDocumentAccess } from "@/lib/documents/access";
import { logActivity } from "@/lib/activity";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const session = await requireSession({
      rateLimitKey: "summarize",
      limit: 15,
      windowMs: 60_000,
    });

    const { id } = await params;
    const { document: doc } = await requireDocumentAccess(session.user, id);

    if (doc.status !== "ready") {
      throw new ApiError(409, "Document is not ready for summarization", "not_ready");
    }

    const summary = await summarizeDocument(id);

    void logActivity({
      user: session.user,
      action: "summarize",
      details: {
        document_id: id,
        document_name: doc.document_name,
      },
    });

    return jsonOk({
      document_id: id,
      document_name: doc.document_name,
      summary,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
