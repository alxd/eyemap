import { UploadForm } from "@/components/UploadForm";

export default function NewCasePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Încărcare fund de ochi</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Imaginile sunt stocate pe MinIO. Metadatele rămân în baza de date.
          Modelele selectate în Setări vor rula pe worker-ul GPU.
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
