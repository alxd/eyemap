import Link from "next/link";
import { CasesTable } from "@/components/CasesTable";

export default function CasesPage() {
  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Cazuri</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Statusul se actualizează automat cât timp cazurile sunt în coadă sau în procesare.
          </p>
        </div>
        <Link
          href="/cases/new"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
        >
          Încărcare nouă
        </Link>
      </div>
      <CasesTable />
    </div>
  );
}
