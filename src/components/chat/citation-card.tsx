"use client";

import { motion } from "framer-motion";
import { FileText } from "lucide-react";

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
    <motion.button
      type="button"
      disabled={!interactive}
      onClick={() => onOpen?.(citation)}
      whileHover={interactive ? { y: -2, scale: 1.01 } : undefined}
      whileTap={interactive ? { scale: 0.99 } : undefined}
      className={`w-full rounded-xl border border-border bg-surface-muted/70 px-3 py-2.5 text-left text-xs text-foreground transition-colors ${
        interactive
          ? "cursor-pointer hover:border-primary/40 hover:bg-surface hover:shadow-sm hover:shadow-primary/10"
          : ""
      }`}
    >
      <p className="flex min-w-0 items-center gap-1.5 font-semibold">
        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="min-w-0 truncate">{citation.document_name}</span>
        {citation.page != null ? (
          <span className="shrink-0 font-medium text-accent">
            · Page {citation.page}
          </span>
        ) : null}
        {interactive ? (
          <span className="ml-auto shrink-0 font-normal text-text-secondary">
            Open
          </span>
        ) : null}
      </p>
      <p className="mt-1.5 line-clamp-2 text-text-secondary">{citation.snippet}</p>
    </motion.button>
  );
}
