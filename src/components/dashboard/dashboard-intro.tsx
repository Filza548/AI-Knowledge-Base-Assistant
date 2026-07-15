"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FileSearch, MessageSquareQuote, ShieldCheck } from "lucide-react";

const features = [
  {
    title: "Cited answers",
    body: "Every substantive reply points back to a document and page — so you can trust what you read.",
    image: "/images/kb-chat.png",
    icon: MessageSquareQuote,
  },
  {
    title: "Search your docs",
    body: "Ask about policies, SOPs, and product PDFs. The knowledge base retrieves the closest chunks first.",
    image: "/images/kb-docs.png",
    icon: FileSearch,
  },
  {
    title: "Secure workspace",
    body: "Role-based access for viewers and admins. Short sessions keep company knowledge protected.",
    image: "/images/kb-hero.png",
    icon: ShieldCheck,
  },
];

export function DashboardIntro({ name }: { name?: string | null }) {
  const greeting = name?.split(" ")[0] || "there";

  return (
    <section className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-sm"
      >
        <div className="ambient-glow -top-32 right-0 opacity-50" />
        <div className="grid items-center gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative z-10 space-y-4 p-6 sm:p-8 lg:pr-2">
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
              Introduction
            </p>
            <h1 className="max-w-xl text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Welcome{greeting !== "there" ? `, ${greeting}` : ""} — this is your{" "}
              <span className="text-primary">AI Knowledge Base</span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
              Upload company PDFs and DOCX files, then ask natural questions.
              The assistant answers only from your indexed documents and shows
              <strong className="font-semibold text-foreground"> sources </strong>
              so teammates can verify every claim.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                RAG chat
              </span>
              <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
                Page citations
              </span>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-text-secondary">
                Collections · history
              </span>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="#knowledge-chat"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-primary/25 transition hover:-translate-y-0.5 hover:bg-primary-hover"
              >
                Start asking
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/document-workspace"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-surface-muted"
              >
                Open documents
              </Link>
            </div>
          </div>
          <div className="relative min-h-[220px] sm:min-h-[280px]">
            <Image
              src="/images/kb-hero.png"
              alt="AI Knowledge Base — documents and grounded answers"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 42vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-surface via-transparent to-transparent lg:from-transparent" />
          </div>
        </div>
      </motion.div>

      <div>
        <h2 className="text-lg font-bold tracking-tight">How this workspace helps</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Three things this product is built for — discover, verify, and manage
          company knowledge.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.35 }}
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
            >
              <div className="relative h-36 bg-surface-muted">
                <Image
                  src={f.image}
                  alt={f.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="font-semibold tracking-tight">{f.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {f.body}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>

      <div className="space-y-1 pt-2">
        <h2 className="text-lg font-bold tracking-tight">Ask the knowledge base</h2>
        <p className="text-sm text-text-secondary">
          Use the chat below for grounded Q&amp;A. Pick a collection if you want
          to limit the search scope.
        </p>
      </div>
    </section>
  );
}
