import Link from "next/link";

import { AppShell } from "@/app/_components/app-shell";
import { auth } from "@/server/auth";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
          St<span className="text-violet-400">acks</span>
        </h1>
        <p className="max-w-md text-center text-lg text-white/60">
          A personal knowledge base you talk to. Drop links and ideas the moment
          they occur to you; pull them back out later by just asking.
        </p>
        <Link
          href="/api/auth/signin"
          className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
        >
          Sign in
        </Link>
        <p className="max-w-sm text-center text-xs text-white/30">
          Not a secrets vault — never save passwords or API keys here.
        </p>
      </main>
    );
  }

  return <AppShell />;
}
