import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(10,10,15,0.85)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/cases" className="font-semibold tracking-wide">
              <span className="text-[var(--primary)]">EyeMap</span> Clinica
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <Link href="/cases" className="hover:text-white">
                Cazuri
              </Link>
              <Link href="/cases/new" className="hover:text-white">
                Încărcare nouă
              </Link>
              <Link href="/patients" className="hover:text-white">
                Pacienți
              </Link>
              <Link href="/settings" className="hover:text-white">
                Setări
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="text-white">{session.user.name}</div>
              <div className="text-xs text-[var(--muted)]">{session.user.email}</div>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--muted)] hover:border-white/30 hover:text-white"
              >
                Deconectare
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
