"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";

type CaseDetail = {
  id: string;
  status: "pending_upload" | "queued" | "processing" | "done" | "failed";
  eye: string;
  imageKey: string | null;
  imageUrl: string | null;
  attempts: number;
  error: string | null;
  result: {
    confidences?: Record<string, number>;
    narrative?: string;
    model?: string;
    completed_at?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  patientRef: string | null;
  patientBirthYear: number | null;
  patientSex: string;
  patientNotes: string | null;
  doctorName: string;
  doctorEmail: string;
};

export function CaseDetailView({ caseId }: { caseId: string }) {
  const [data, setData] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Case not found");
      return;
    }
    const json = await res.json();
    setData(json.case);
    setError(null);
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    if (data.status === "done" || data.status === "failed") return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [data, load]);

  if (error) {
    return <p className="text-[var(--danger)]">{error}</p>;
  }

  if (!data) {
    return <p className="text-[var(--muted)]">Loading case…</p>;
  }

  const confidences = data.result?.confidences || {};
  const sorted = Object.entries(confidences).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/cases" className="text-sm text-[var(--muted)] hover:text-white">
            ← Back to cases
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            Case {data.id.slice(0, 8)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={data.status} />
            <span className="text-sm text-[var(--muted)]">
              Eye {data.eye.toUpperCase()} · {data.doctorName}
            </span>
          </div>
        </div>
        {(data.status === "queued" || data.status === "processing") && (
          <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-2 text-sm text-[var(--primary)]">
            Waiting for GPU worker… auto-refreshing
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
            Fundus image
          </h2>
          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.imageUrl}
              alt="Fundus"
              className="max-h-[480px] w-full rounded-xl object-contain bg-black/40"
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">No image available</p>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
              Patient
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Reference</dt>
                <dd>{data.patientRef || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Sex</dt>
                <dd className="capitalize">{data.patientSex}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Birth year</dt>
                <dd>{data.patientBirthYear || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Attempts</dt>
                <dd>{data.attempts}</dd>
              </div>
              {data.patientNotes && (
                <div className="col-span-2">
                  <dt className="text-[var(--muted)]">Notes</dt>
                  <dd>{data.patientNotes}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
              Screening scores
            </h2>
            {data.status === "done" && sorted.length > 0 ? (
              <ul className="space-y-3">
                {sorted.map(([label, value]) => (
                  <li key={label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="capitalize">{label.replace(/_/g, " ")}</span>
                      <span className="text-[var(--muted)]">
                        {(value * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : data.status === "failed" ? (
              <p className="text-sm text-[var(--danger)]">{data.error || "Failed"}</p>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Scores will appear when inference completes.
              </p>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
          MedGemma screening narrative
        </h2>
        {data.result?.narrative ? (
          <div className="space-y-2">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#d8d8e8]">
              {data.result.narrative}
            </p>
            <p className="text-xs text-[var(--muted)]">
              Model: {data.result.model}
              {data.result.completed_at
                ? ` · ${new Date(data.result.completed_at).toLocaleString()}`
                : ""}
            </p>
            <p className="text-xs text-[var(--warning)]">
              Research / screening aid only — not a clinical diagnosis. Review by a
              qualified ophthalmologist is required.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {data.status === "failed"
              ? data.error || "Inference failed"
              : "Narrative report pending…"}
          </p>
        )}
      </section>
    </div>
  );
}
