"use client";

type Citation = {
  document_id: string;
  document_name: string;
  page: number | null;
  snippet: string;
};

export function CitationCard({
  citation,
  onOpen,
}: {
  citation: Citation;
  onOpen?: (citation: Citation) => void;
}) {
  const interactive = Boolean(onOpen);

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onOpen?.(citation)}
      className={`w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs text-zinc-700 transition-colors ${
        interactive ? "cursor-pointer hover:border-zinc-400 hover:bg-white" : ""
      }`}
    >
      <p className="font-medium">
        {citation.document_name}
        {citation.page != null ? ` · Page ${citation.page}` : ""}
        {interactive ? (
          <span className="ml-2 font-normal text-zinc-400">Open source</span>
        ) : null}
      </p>
      <p className="mt-1 line-clamp-2 text-zinc-500">{citation.snippet}</p>
    </button>
  );
}
