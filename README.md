# AI Knowledge Assistant

Full-stack enterprise knowledge assistant: **Next.js + Tailwind UI + Auth.js + Supabase PostgreSQL/pgvector + OpenAI RAG**.

## What you get

- **Login** — credentials (+ optional Google OAuth)
- **Dashboard** — semantic search + chat with citations, history, collections, follow-ups
- **Document workspace** — summarize / extract metadata / ask about one doc
- **Admin** — upload/reindex, collections, users, usage analytics
- **RAG** — LangChain chunking → OpenAI embeddings → pgvector → GPT answers
- **Polish** — citation→PDF jump, confidence badge, export answer, upload progress

## Stack (as built)

| Layer | Choice |
|-------|--------|
| Frontend | Next.js App Router + Tailwind + shadcn-style UI |
| Auth | Auth.js (credentials + optional Google) |
| Database | Supabase PostgreSQL + pgvector |
| Storage | Supabase Storage (`documents` bucket) |
| AI | OpenAI chat + `text-embedding-3-small` |
| Chunking | LangChain `RecursiveCharacterTextSplitter` |
| Prisma | Schema included (`prisma/schema.prisma`) — runtime uses Supabase client for vectors/Storage |

## Folder map

```
src/
  app/
    (app)/                 # authenticated shell + sidebar
      dashboard/
      document-workspace/
      admin-settings/
    login/
    api/                   # chat, search, documents, admin
  components/
    chat/ search/ sidebar/ uploader/ document/ admin/ ui/
  lib/
    auth.ts rag.ts embeddings.ts documents/indexer.ts
prisma/schema.prisma
supabase/migrations/001_initial.sql
supabase/migrations/002_feature_wave.sql
```

## Setup

1. Run SQL migrations in Supabase SQL Editor:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_feature_wave.sql`
2. Fill `.env.local` (see `.env.example`).
3. `npm install && npm run seed:admin && npm run dev`
4. Login: `admin@example.com` / `ChangeMeNow1!`
5. Admin → upload a PDF → Dashboard → ask a question.

Optional Google: set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (user must already exist in `users`).

Optional Prisma: add `DATABASE_URL` from Supabase Database settings, then `npx prisma generate`.

## Security

JWT 15-min sessions · RBAC (viewer/admin) · bcrypt passwords · AES-256-GCM paths · Zod validation · rate limits · RLS · private storage · security headers.
