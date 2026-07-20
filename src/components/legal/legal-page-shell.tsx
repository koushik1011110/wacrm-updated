import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KkWabaLogo } from "@/components/brand/kk-waba-logo";

type LegalPageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function LegalPageShell({
  title,
  description,
  children,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-[#fcfcfb] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center" aria-label="KK WABA home">
            <KkWabaLogo priority className="h-10 max-w-[185px] sm:h-11 sm:max-w-[210px]" />
          </Link>
          <Link href="/login" className="text-sm font-semibold text-slate-600 transition-colors hover:text-emerald-700">
            Log in
          </Link>
        </div>
      </header>

      <section className="border-b border-emerald-100 bg-[#f2f8f4]">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-16">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-[-0.05em] text-slate-950 sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">{description}</p>
          <p className="mt-5 text-sm font-medium text-slate-500">Last updated: July 20, 2026</p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="legal-content space-y-10 text-[15px] leading-7 text-slate-600">{children}</div>
      </article>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} KK WABA.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal navigation">
            <Link href="/privacy-policy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link href="/terms-of-service" className="hover:text-slate-900">Terms of Service</Link>
            <Link href="/data-deletion" className="hover:text-slate-900">Data Deletion</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
