"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Patient = {
  id: string;
  externalRef: string | null;
  birthYear: number | null;
  sex: string;
  notes: string | null;
  createdAt: string;
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patients")
      .then((r) => r.json())
      .then((d) => setPatients(d.patients || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Patients</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Clinic-scoped patient metadata (no raw images stored in the database).
          </p>
        </div>
        <Link
          href="/cases/new"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          New case
        </Link>
      </div>

      {loading ? (
        <p className="text-[var(--muted)]">Loading…</p>
      ) : !patients.length ? (
        <p className="text-[var(--muted)]">No patients yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Sex</th>
                <th className="px-4 py-3 font-medium">Birth year</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.externalRef || p.id.slice(0, 8)}</div>
                    {p.notes && (
                      <div className="text-xs text-[var(--muted)]">{p.notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{p.sex}</td>
                  <td className="px-4 py-3">{p.birthYear || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
