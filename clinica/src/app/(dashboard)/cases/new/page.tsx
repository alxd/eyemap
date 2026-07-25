import { UploadForm } from "@/components/UploadForm";

export default function NewCasePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">New fundus upload</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Images go to MinIO on the GPU machine. Metadata is stored in Postgres.
          Inference is queued for MedGemma.
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
