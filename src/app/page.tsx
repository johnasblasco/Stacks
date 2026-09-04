import Link from "next/link";

import { AppShell } from "@/app/_components/app-shell";
import { auth } from "@/server/auth";

const features = [
  ["Capture", "Save a link or thought before it disappears."],
  ["Organize", "Let folders and smart context keep ideas findable."],
  ["Recall", "Ask your library and surface the cards that matter."],
] as const;

export default async function Home() {
  const session = await auth();

  if (session?.user) return <AppShell />;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090b12] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(124,92,255,0.28),transparent_34%),radial-gradient(circle_at_85%_75%,rgba(54,211,153,0.13),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:64px_64px] opacity-[0.12]" />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-7 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-lg font-bold shadow-lg shadow-violet-500/30">
            S
          </span>
          <span className="text-lg font-bold tracking-tight">Stacks</span>
        </div>
        <Link
          href="/api/auth/signin"
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Sign in
        </Link>
      </nav>

      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pt-16 pb-20 text-center sm:pt-24 lg:px-8">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />A calmer
          home for everything worth remembering
        </div>
        <h1 className="max-w-4xl text-5xl font-bold tracking-[-0.055em] text-balance sm:text-7xl lg:text-8xl">
          Keep the thought.
          <span className="block bg-gradient-to-r from-violet-300 via-white to-emerald-200 bg-clip-text text-transparent">
            Find it when it matters.
          </span>
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-8 text-pretty text-white/55 sm:text-lg">
          Stacks is your private knowledge library for links, notes, and
          unfinished ideas—organized quietly and ready to answer when you ask.
        </p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/api/auth/signin"
            className="rounded-2xl bg-violet-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-500"
          >
            Open your library →
          </Link>
          <span className="text-xs text-white/35">Your notes stay yours.</span>
        </div>

        <div className="mt-20 grid w-full max-w-5xl gap-4 text-left md:grid-cols-3">
          {features.map(([title, description], index) => (
            <article
              key={title}
              className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.065]"
            >
              <span className="mb-8 block text-xs font-bold tracking-[0.18em] text-violet-300/70">
                0{index + 1}
              </span>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">
                {description}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-10 max-w-md text-xs text-white/25">
          Not a secrets vault—never store passwords, recovery codes, or API
          keys.
        </p>
      </section>
    </main>
  );
}
