"use client";

import { FormEvent, useEffect, useState } from "react";

type ModelInfo = {
  id: string;
  label: string;
  description: string;
};

export default function SettingsPage() {
  const [clinicName, setClinicName] = useState("");
  const [available, setAvailable] = useState<ModelInfo[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then(async (r) => {
        if (!r.ok) throw new Error("Nu s-au putut încărca setările");
        return r.json();
      })
      .then((d) => {
        setClinicName(d.clinic?.name || "");
        setAvailable(d.availableModels || []);
        setEnabled(d.enabledModels || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setEnabled((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!enabled.length) {
      setError("Selectați cel puțin un model");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledModels: enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Salvare eșuată");
      setEnabled(data.enabledModels || enabled);
      setMessage("Setările au fost salvate. Se aplică la încărcările noi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-[var(--muted)]">Se încarcă setările…</p>;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Setări</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {clinicName
            ? `Clinică: ${clinicName}. `
            : ""}
          Alegeți modelele care vor rula pentru fiecare caz nou.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <h2 className="text-sm uppercase tracking-wider text-[var(--muted)]">
          Modele de screening
        </h2>

        <ul className="space-y-3">
          {available.map((m) => {
            const checked = enabled.includes(m.id);
            return (
              <li key={m.id}>
                <label className="flex cursor-pointer gap-3 rounded-xl border border-[var(--border)] p-4 hover:bg-white/[0.02]">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggle(m.id)}
                  />
                  <span>
                    <span className="block font-medium text-white">{m.label}</span>
                    <span className="mt-0.5 block text-sm text-[var(--muted)]">
                      {m.description}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {error && (
          <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[var(--primary)] px-5 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-60"
        >
          {saving ? "Se salvează…" : "Salvează setările"}
        </button>
      </form>
    </div>
  );
}
