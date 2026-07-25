"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CaseListItem, StatusBadge } from "@/components/StatusBadge";

function isActive(status: CaseListItem["status"]) {
  return status === "queued" || status === "processing" || status === "pending_upload";
}

const SEX_RO: Record<string, string> = {
  male: "masculin",
  female: "feminin",
  other: "altul",
  unknown: "necunoscut",
};

export function CasesTable() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cases", { cache: "no-store" });
      if (!res.ok) throw new Error("Nu s-au putut încărca cazurile");
      const data = await res.json();
      setCases(data.cases || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const hasActive = cases.some((c) => isActive(c.status));
    if (!hasActive) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [cases, load]);

  if (loading) {
    return <p className="text-[var(--muted)]">Se încarcă cazurile…</p>;
  }

  if (error) {
    return (
      <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-[var(--danger)]">
        {error}
      </p>
    );
  }

  if (!cases.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
        <p className="text-[var(--muted)]">Nu există cazuri încă.</p>
        <Link
          href="/cases/new"
          className="mt-4 inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-white"
        >
          Încărcați prima imagine de fund de ochi
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3 font-medium">Pacient</th>
            <th className="px-4 py-3 font-medium">Ochi</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Medic</th>
            <th className="px-4 py-3 font-medium">Creat</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} className="border-t border-[var(--border)] hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <div className="font-medium text-white">
                  {c.patientRef || c.patientId.slice(0, 8)}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {SEX_RO[c.patientSex] || c.patientSex}
                  {c.patientBirthYear ? ` · ${c.patientBirthYear}` : ""}
                </div>
              </td>
              <td className="px-4 py-3 uppercase">{c.eye}</td>
              <td className="px-4 py-3">
                <StatusBadge status={c.status} />
                {c.error && (
                  <div className="mt-1 max-w-xs truncate text-xs text-[var(--danger)]">
                    {c.error}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-[var(--muted)]">{c.doctorName}</td>
              <td className="px-4 py-3 text-[var(--muted)]">
                {new Date(c.createdAt).toLocaleString("ro-RO")}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/cases/${c.id}`}
                  className="text-[var(--primary)] hover:underline"
                >
                  Deschide
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
