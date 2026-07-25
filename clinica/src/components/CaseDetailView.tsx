"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { CaseResult } from "@/db/schema";

type CaseDetail = {
  id: string;
  status: "pending_upload" | "queued" | "processing" | "done" | "failed";
  eye: string;
  imageKey: string | null;
  imageUrl: string | null;
  attempts: number;
  error: string | null;
  result: CaseResult | null;
  createdAt: string;
  updatedAt: string;
  patientRef: string | null;
  patientBirthYear: number | null;
  patientSex: string;
  patientNotes: string | null;
  doctorName: string;
  doctorEmail: string;
};

const SEX_RO: Record<string, string> = {
  male: "masculin",
  female: "feminin",
  other: "altul",
  unknown: "necunoscut",
};

const LABEL_RO: Record<string, string> = {
  normal: "Normal",
  diabetic_retinopathy: "Retinopatie diabetică",
  amd: "DMAE (AMD)",
  glaucoma: "Glaucom",
  confidence: "Încredere",
  image_quality: "Calitate imagine",
  optic_disc: "Disc optic",
  retinal_vessels: "Vase retiniene",
  macula: "Maculă",
  drusen: "Drusen",
  geographic_atrophy: "Atrofie geografică",
  hemorrhage: "Hemoragie",
  fluid: "Fluid",
  most_likely_diagnosis: "Diagnostic cel mai probabil",
  pathology: "Patologie",
  stage: "Stadiu",
  fibrosis: "Fibroză",
  cnv_scar: "Cicatrice CNV",
  active_exudation: "Exudație activă",
  visual_prognosis: "Prognostic vizual",
};

function ConfidenceBars({ scores }: { scores: Record<string, number> }) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  return (
    <ul className="space-y-3">
      {sorted.map(([label, value]) => (
        <li key={label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{LABEL_RO[label] || label.replace(/_/g, " ")}</span>
            <span className="text-[var(--muted)]">{(value * 100).toFixed(1)}%</span>
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
  );
}

function FieldTable({
  fields,
}: {
  fields: Array<[string, string | number | undefined]>;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 text-sm">
      {fields.map(([key, val]) => (
        <div key={key} className="rounded-lg border border-[var(--border)] p-3">
          <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
            {LABEL_RO[key] || key}
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-[#d8d8e8]">
            {val === undefined || val === null || val === "" ? "—" : String(val)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CaseDetailView({ caseId }: { caseId: string }) {
  const [data, setData] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Cazul nu a fost găsit");
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
    return <p className="text-[var(--muted)]">Se încarcă cazul…</p>;
  }

  const result = data.result;
  const medgemma =
    result?.medgemma ||
    (result?.confidences
      ? {
          confidences: result.confidences,
          narrative: result.narrative || "",
          model: result.model || "medgemma",
        }
      : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/cases" className="text-sm text-[var(--muted)] hover:text-white">
            ← Înapoi la cazuri
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            Caz {data.id.slice(0, 8)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={data.status} />
            <span className="text-sm text-[var(--muted)]">
              Ochi {data.eye.toUpperCase()} · {data.doctorName}
            </span>
          </div>
        </div>
        {(data.status === "queued" || data.status === "processing") && (
          <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-2 text-sm text-[var(--primary)]">
            Se așteaptă worker-ul GPU… actualizare automată
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
            Imagine fund de ochi
          </h2>
          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.imageUrl}
              alt="Fund de ochi"
              className="max-h-[480px] w-full rounded-xl object-contain bg-black/40"
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">Imagine indisponibilă</p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
            Pacient
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Referință</dt>
              <dd>{data.patientRef || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Sex</dt>
              <dd>{SEX_RO[data.patientSex] || data.patientSex}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">An naștere</dt>
              <dd>{data.patientBirthYear || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Încercări</dt>
              <dd>{data.attempts}</dd>
            </div>
            {data.patientNotes && (
              <div className="col-span-2">
                <dt className="text-[var(--muted)]">Note</dt>
                <dd>{data.patientNotes}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      {data.status === "failed" && (
        <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {data.error || "Analiza a eșuat"}
        </p>
      )}

      {data.status === "done" && result && (
        <div className="space-y-6">
          {medgemma && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
                MG — scoruri
              </h2>
              <ConfidenceBars scores={medgemma.confidences || {}} />
              {medgemma.narrative && (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <h3 className="mb-2 text-sm text-[var(--muted)]">Narativ screening</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#d8d8e8]">
                    {medgemma.narrative}
                  </p>
                </div>
              )}
            </section>
          )}

          {result["eyemap-retinopathy"] && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
                EyeMap — Retinopatie diabetică
              </h2>
              <ConfidenceBars
                scores={{
                  retinopatie_diabetica:
                    result["eyemap-retinopathy"].disease_probability,
                  fara_boala:
                    1 - result["eyemap-retinopathy"].disease_probability,
                }}
              />
            </section>
          )}

          {result["eyemap-amd"] && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
                EyeMap — DMAE (AMD)
              </h2>
              <ConfidenceBars
                scores={{
                  dmae: result["eyemap-amd"].disease_probability,
                  fara_boala: 1 - result["eyemap-amd"].disease_probability,
                }}
              />
            </section>
          )}

          {result.medsiglip?.confidences && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
                MedSigLIP
              </h2>
              <ConfidenceBars scores={result.medsiglip.confidences} />
            </section>
          )}

          {result["eyemap-top"] && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="mb-3 text-sm uppercase tracking-wider text-[var(--muted)]">
                EyeMap Top — raport structurat
              </h2>
              <FieldTable
                fields={[
                  ["confidence", result["eyemap-top"].confidence],
                  ["image_quality", result["eyemap-top"].image_quality],
                  ["optic_disc", result["eyemap-top"].optic_disc],
                  ["retinal_vessels", result["eyemap-top"].retinal_vessels],
                  ["macula", result["eyemap-top"].macula],
                  ["drusen", result["eyemap-top"].drusen],
                  ["geographic_atrophy", result["eyemap-top"].geographic_atrophy],
                  ["hemorrhage", result["eyemap-top"].hemorrhage],
                  ["fluid", result["eyemap-top"].fluid],
                  [
                    "most_likely_diagnosis",
                    result["eyemap-top"].most_likely_diagnosis,
                  ],
                  ["pathology", result["eyemap-top"].pathology],
                  ["stage", result["eyemap-top"].stage],
                  ["fibrosis", result["eyemap-top"].fibrosis],
                  ["cnv_scar", result["eyemap-top"].cnv_scar],
                  ["active_exudation", result["eyemap-top"].active_exudation],
                  ["visual_prognosis", result["eyemap-top"].visual_prognosis],
                ]}
              />
            </section>
          )}

          {result.errors && Object.keys(result.errors).length > 0 && (
            <section className="rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm">
              <h2 className="mb-2 text-[var(--warning)]">Erori parțiale pe modele</h2>
              <ul className="space-y-1 text-[var(--muted)]">
                {Object.entries(result.errors).map(([model, msg]) => (
                  <li key={model}>
                    <strong className="text-white">{model}:</strong> {msg}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-xs text-[var(--warning)]">
            Ajutor de screening / cercetare — nu înlocuiește diagnosticul unui
            oftalmolog calificat.
          </p>
          {result.completed_at && (
            <p className="text-xs text-[var(--muted)]">
              Finalizat: {new Date(result.completed_at).toLocaleString("ro-RO")}
            </p>
          )}
        </div>
      )}

      {data.status !== "done" && data.status !== "failed" && (
        <p className="text-sm text-[var(--muted)]">
          Raportul va apărea când inferența se încheie.
        </p>
      )}
    </div>
  );
}
