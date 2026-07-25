"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Patient = {
  id: string;
  externalRef: string | null;
  birthYear: number | null;
  sex: string;
};

export function UploadForm() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [patientId, setPatientId] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [sex, setSex] = useState("unknown");
  const [notes, setNotes] = useState("");
  const [eye, setEye] = useState("unknown");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/patients")
      .then((r) => r.json())
      .then((d) => setPatients(d.patients || []))
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Selectați o imagine de fund de ochi");
      return;
    }

    setSubmitting(true);
    setError(null);
    setProgress("Se creează cazul…");

    try {
      const metaRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: mode === "existing" ? patientId || undefined : undefined,
          externalRef: mode === "new" ? externalRef || undefined : undefined,
          birthYear:
            mode === "new" && birthYear ? Number(birthYear) : undefined,
          sex: mode === "new" ? sex : undefined,
          notes: mode === "new" ? notes || undefined : undefined,
          eye,
          filename: file.name,
          contentType: file.type || "image/jpeg",
        }),
      });

      if (!metaRes.ok) {
        const data = await metaRes.json().catch(() => ({}));
        throw new Error(data.error || "Nu s-a putut crea cazul");
      }

      const { caseId, uploadUrl, contentType } = await metaRes.json();
      setProgress("Se încarcă imaginea în stocare…");

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Încărcarea imaginii a eșuat (${putRes.status})`);
      }

      setProgress("Se pune în coadă pentru inferență GPU…");
      const confirmRes = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });

      if (!confirmRes.ok) {
        const data = await confirmRes.json().catch(() => ({}));
        throw new Error(data.error || "Nu s-a putut pune cazul în coadă");
      }

      setProgress("În coadă — redirecționare…");
      router.push(`/cases/${caseId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Încărcare eșuată");
      setProgress(null);
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-2xl space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"
    >
      <div className="flex gap-2 rounded-lg bg-white/5 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`flex-1 rounded-md px-3 py-2 ${
            mode === "new" ? "bg-[var(--primary)] text-white" : "text-[var(--muted)]"
          }`}
        >
          Pacient nou
        </button>
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`flex-1 rounded-md px-3 py-2 ${
            mode === "existing"
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--muted)]"
          }`}
        >
          Pacient existent
        </button>
      </div>

      {mode === "new" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-[var(--muted)]">
              Referință pacient / Nr. fișă
            </span>
            <input
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Opțional"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">An naștere</span>
            <input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="1955"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Sex</span>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="unknown">Necunoscut</option>
              <option value="female">Feminin</option>
              <option value="male">Masculin</option>
              <option value="other">Altul</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-[var(--muted)]">Note</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </label>
        </div>
      ) : (
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Pacient</span>
          <select
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value="">Selectați pacientul…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.externalRef || p.id.slice(0, 8)} · {p.sex}
                {p.birthYear ? ` · ${p.birthYear}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Ochi</span>
          <select
            value={eye}
            onChange={(e) => setEye(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value="unknown">Necunoscut</option>
            <option value="L">Stâng (OS)</option>
            <option value="R">Drept (OD)</option>
            <option value="both">Ambii</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">Imagine fund de ochi</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            required
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-[var(--primary)] file:px-2 file:py-1 file:text-xs file:text-white"
          />
        </label>
      </div>

      {progress && (
        <p className="text-sm text-[var(--primary)]">{progress}</p>
      )}
      {error && (
        <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-[var(--primary)] px-5 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-60"
      >
        {submitting ? "Se încarcă…" : "Încarcă și analizează"}
      </button>
    </form>
  );
}
