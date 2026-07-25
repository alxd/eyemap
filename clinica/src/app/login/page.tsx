"use client";

import { FormEvent, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/cases";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email sau parolă invalidă");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-2xl backdrop-blur"
    >
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--primary)]">
          EyeMap
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Autentificare Clinica</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Conectați-vă pentru a încărca imagini de fund de ochi și a consulta rapoartele de screening.
        </p>
      </div>

      <label className="mb-4 block text-sm">
        <span className="mb-1.5 block text-[var(--muted)]">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 outline-none ring-[var(--primary)] focus:ring-2"
          placeholder="medic@clinica.ro"
          autoComplete="username"
        />
      </label>

      <label className="mb-6 block text-sm">
        <span className="mb-1.5 block text-[var(--muted)]">Parolă</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 outline-none ring-[var(--primary)] focus:ring-2"
          autoComplete="current-password"
        />
      </label>

      {error && (
        <p className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 font-medium text-white transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
      >
        {loading ? "Se conectează…" : "Conectare"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(120,119,198,0.18),_transparent_55%)] px-4">
      <Suspense fallback={<div className="text-[var(--muted)]">Se încarcă…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
