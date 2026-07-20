import type { Metadata } from "next";
import Link from "next/link";
import { KkWabaLogo } from "@/components/brand/kk-waba-logo";
import {
  ArrowRight,
  ChevronRight,
  ContactRound,
  Gauge,
  MessageCircleMore,
  Play,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "WhatsApp API CRM",
  description:
    "Manage WhatsApp conversations, customers, campaigns, and automations from one focused workspace.",
};

const features = [
  {
    icon: MessageCircleMore,
    title: "One shared inbox",
    description:
      "Keep every customer conversation visible, assigned, and moving forward.",
  },
  {
    icon: ContactRound,
    title: "Customers that stay organized",
    description:
      "Build a complete customer view with smart segments, notes, and activity history.",
  },
  {
    icon: Zap,
    title: "Automation that feels human",
    description:
      "Turn repeatable conversations into reliable, always-on workflows.",
  },
];

const conversationRows = [
  {
    initials: "AN",
    name: "Ananya Nair",
    text: "Yes, I would like to know more.",
    time: "10:42 AM",
    color: "bg-amber-100 text-amber-700",
  },
  {
    initials: "RK",
    name: "Rahul Khanna",
    text: "Thank you for the quick response!",
    time: "10:31 AM",
    color: "bg-sky-100 text-sky-700",
  },
  {
    initials: "SP",
    name: "Sneha Patel",
    text: "Could you share the pricing details?",
    time: "9:56 AM",
    color: "bg-rose-100 text-rose-700",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fcfcfb] text-slate-950">
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 -z-10 h-[620px] overflow-hidden bg-[#f5f8f3]">
          <div className="absolute left-1/2 top-[-220px] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-200/50 blur-3xl" />
          <div className="absolute right-[-200px] top-[100px] h-[340px] w-[340px] rounded-full bg-lime-200/50 blur-3xl" />
        </div>

        <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center" aria-label="KK WABA home">
            <KkWabaLogo priority className="h-10 max-w-[175px] sm:h-11 sm:max-w-[210px]" />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex" aria-label="Main navigation">
            <a href="#features" className="transition-colors hover:text-slate-950">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-slate-950">How it works</a>
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link href="/login" className="px-2 py-2 text-sm font-semibold text-slate-700 transition-colors hover:text-emerald-700 sm:px-3">
              Log in
            </Link>
            <Link href="/signup" className="rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition-all hover:-translate-y-0.5 hover:bg-slate-800 sm:px-5">
              Get started
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-5 pb-20 pt-14 text-center sm:px-8 sm:pt-20 lg:pb-28 lg:pt-24">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Built for conversations that convert
          </div>
          <h1 className="mx-auto mt-7 max-w-4xl text-balance text-4xl font-bold tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl lg:leading-[1.03]">
            The calm way to grow on WhatsApp.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Bring your conversations, customers, campaigns, and automations into one beautifully simple workspace.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white shadow-xl shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700">
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50">
              <Play className="h-4 w-4 fill-current" /> See how it works
            </a>
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">No credit card required</p>

          <div className="relative mx-auto mt-14 max-w-5xl rounded-[1.6rem] border border-slate-200/90 bg-white p-2 shadow-2xl shadow-slate-900/10 sm:mt-18 sm:p-3">
            <div className="overflow-hidden rounded-[1.15rem] border border-slate-100 bg-slate-50 text-left">
              <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <KkWabaLogo className="h-7 max-w-[120px]" />
                </div>
                <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:block">All systems active</span>
                <span className="h-7 w-7 rounded-full bg-slate-200" />
              </div>
              <div className="grid min-h-[360px] grid-cols-1 sm:grid-cols-[minmax(220px,0.78fr)_minmax(0,1.35fr)]">
                <aside className="hidden border-r border-slate-200 bg-white p-4 sm:block">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-bold">Inbox</span>
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">12 new</span>
                  </div>
                  <div className="space-y-1">
                    {conversationRows.map((item, index) => (
                      <div key={item.name} className={`flex gap-2.5 rounded-lg p-2.5 ${index === 0 ? "bg-emerald-50" : ""}`}>
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${item.color}`}>{item.initials}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold">{item.name}</span><span className="shrink-0 text-[9px] text-slate-400">{item.time}</span></span>
                          <span className="mt-0.5 block truncate text-[10px] text-slate-500">{item.text}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </aside>
                <div className="flex min-w-0 flex-col bg-[#f8faf8]">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">AN</span>
                      <div><p className="text-xs font-bold">Ananya Nair</p><p className="text-[10px] text-emerald-600">Online</p></div>
                    </div>
                    <span className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500">Customer</span>
                  </div>
                  <div className="flex flex-1 flex-col justify-end gap-3 p-4 sm:p-5">
                    <div className="max-w-[76%] rounded-2xl rounded-bl-md bg-white px-3 py-2.5 text-[11px] leading-5 text-slate-600 shadow-sm">Hi Ananya! I&apos;m happy to help. Which plan are you looking at?</div>
                    <div className="ml-auto max-w-[76%] rounded-2xl rounded-br-md bg-emerald-600 px-3 py-2.5 text-[11px] leading-5 text-white shadow-sm">I&apos;d like to know which option works best for a team of five.</div>
                    <div className="max-w-[76%] rounded-2xl rounded-bl-md bg-white px-3 py-2.5 text-[11px] leading-5 text-slate-600 shadow-sm">Great choice. Our team plan includes a shared inbox, automations, and unlimited contacts.</div>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                      <span className="min-w-0 flex-1 px-1 text-[11px] text-slate-400">Write a reply…</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white"><Send className="h-3.5 w-3.5" /></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="features" className="border-y border-slate-200 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-600">Everything in one place</p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">Less switching. More meaningful customer moments.</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-[#fcfcfb] p-6 transition-shadow hover:shadow-lg hover:shadow-slate-900/5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-lg font-bold tracking-[-0.025em]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                <Link href="/signup" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-emerald-700 transition-colors hover:text-emerald-800">Explore feature <ChevronRight className="h-4 w-4" /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#132d25] py-20 text-white sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-300">Designed to move with you</p>
            <h2 className="mt-4 max-w-xl text-3xl font-bold tracking-[-0.045em] sm:text-4xl">From first hello to loyal customer, without losing the thread.</h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/70">Set up your workspace in minutes and give your whole team the context to make every reply count.</p>
            <Link href="/signup" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-emerald-950 transition-transform hover:-translate-y-0.5">Create your workspace <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-3">
            {[
              ["01", "Connect WhatsApp", "Link your business number and bring your conversations into one shared view."],
              ["02", "Make every reply count", "Give your team the customer context and tools to respond with confidence."],
              ["03", "Grow without the busywork", "Use broadcasts and automations to stay helpful at every stage."],
            ].map(([number, title, description]) => (
              <div key={number} className="flex gap-5 rounded-2xl border border-white/10 bg-white/[0.06] p-5 sm:p-6">
                <span className="text-sm font-bold text-emerald-300">{number}</span>
                <div><h3 className="font-bold">{title}</h3><p className="mt-1.5 text-sm leading-6 text-emerald-50/65">{description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#fcfcfb] px-5 py-20 text-center sm:px-8 sm:py-24">
        <Gauge className="mx-auto h-7 w-7 text-emerald-600" />
        <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-bold tracking-[-0.05em] sm:text-4xl">Ready for a more organized WhatsApp business?</h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">Build a customer experience your team can be proud of.</p>
        <Link href="/signup" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700">Start for free <ArrowRight className="h-4 w-4" /></Link>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link href="/" className="flex items-center" aria-label="KK WABA home"><KkWabaLogo className="h-8 max-w-[145px]" /></Link>
          <p>Conversations that build better customer relationships.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2"><Link href="/privacy-policy" className="hover:text-slate-900">Privacy</Link><Link href="/terms-of-service" className="hover:text-slate-900">Terms</Link><Link href="/data-deletion" className="hover:text-slate-900">Data deletion</Link><Link href="/login" className="hover:text-slate-900">Log in</Link><Link href="/signup" className="hover:text-slate-900">Get started</Link></div>
        </div>
      </footer>
    </main>
  );
}
