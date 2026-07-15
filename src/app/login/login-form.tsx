"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoMark } from "@/components/brand/logo-mark";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function LoginForm({
  googleEnabled = false,
}: {
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="ambient-glow -top-24 -left-24" />
      <div className="ambient-glow right-[-10%] bottom-[-20%] opacity-60" />

      <section className="relative z-10 hidden w-[52%] flex-col overflow-hidden border-r border-border lg:flex">
        <div className="absolute inset-0">
          <Image
            src="/images/kb-hero.png"
            alt="AI Knowledge Base introduction"
            fill
            priority
            className="object-cover object-center opacity-90"
            sizes="52vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between px-12 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="flex items-center gap-3"
          >
            <LogoMark size={48} animated />
            <div>
              <p className="text-lg font-bold tracking-tight">
                <span className="text-primary">AI</span> Knowledge Base
              </p>
              <p className="text-sm text-text-secondary">
                Ask your documents. Get answers with sources.
              </p>
            </div>
          </motion.div>

          <div className="max-w-lg space-y-5">
            <motion.p
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-xs font-semibold tracking-[0.18em] text-primary uppercase"
            >
              Product introduction
            </motion.p>
            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-4xl font-extrabold leading-tight tracking-tight text-foreground xl:text-[2.75rem]"
            >
              Your company knowledge,{" "}
              <span className="text-primary">one question away.</span>
            </motion.h1>
            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-base leading-relaxed text-text-secondary"
            >
              AI Knowledge Base is an enterprise RAG assistant: upload PDFs and
              DOCX, index them safely, then chat with grounded answers that show
              document name and page citations.
            </motion.p>
            <motion.ul
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="space-y-2 text-sm text-text-secondary"
            >
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                Dashboard chat with conversation history and collections
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                Document workspace for summarize, extract, and scoped ask
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                Admin upload, reindex, users, and usage analytics
              </li>
            </motion.ul>
            <motion.p
              custom={4}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-xs font-medium tracking-wide text-text-secondary/80 uppercase"
            >
              Secure · role-based · source-backed
            </motion.p>
          </div>

          <div className="flex gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-border shadow-sm">
              <Image src="/images/kb-chat.png" alt="" fill className="object-cover" />
            </div>
            <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-border shadow-sm">
              <Image src="/images/kb-docs.png" alt="" fill className="object-cover" />
            </div>
            <p className="self-center text-xs text-text-secondary/80">
              Enterprise RAG workspace
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-md rounded-3xl border border-border bg-surface/90 p-8 shadow-xl shadow-primary/5 backdrop-blur"
        >
          <div className="mb-8 space-y-3 text-center lg:text-left">
            <div className="mx-auto flex justify-center lg:hidden">
              <LogoMark size={44} animated />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Sign in to continue
            </h2>
            <p className="text-sm text-text-secondary">
              Access your knowledge workspace — chat, documents, and admin tools.
            </p>
          </div>

          <div className="space-y-4">
            {googleEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn("google", { callbackUrl })}
              >
                Continue with Google
              </Button>
            ) : null}

            {googleEnabled ? (
              <div className="relative text-center text-xs text-text-secondary">
                <span className="relative z-10 bg-surface px-2">or email</span>
                <div className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-3">
              <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </motion.div>
              <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
                <Input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </motion.div>
              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </motion.div>
            </form>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
