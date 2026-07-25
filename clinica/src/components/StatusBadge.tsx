export type CaseListItem = {
  id: string;
  status: "pending_upload" | "queued" | "processing" | "done" | "failed";
  eye: string;
  imageKey: string | null;
  attempts: number;
  error: string | null;
  result: {
    confidences?: Record<string, number>;
    narrative?: string;
    model?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  patientId: string;
  patientRef: string | null;
  patientBirthYear: number | null;
  patientSex: string;
  doctorName: string;
};

export const STATUS_LABELS: Record<CaseListItem["status"], string> = {
  pending_upload: "Awaiting upload",
  queued: "In queue",
  processing: "Processing",
  done: "Done",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: CaseListItem["status"] }) {
  const colors: Record<CaseListItem["status"], string> = {
    pending_upload: "border-white/20 text-[var(--muted)]",
    queued: "border-[var(--warning)]/50 text-[var(--warning)]",
    processing: "border-[var(--primary)]/50 text-[var(--primary)]",
    done: "border-[var(--success)]/50 text-[var(--success)]",
    failed: "border-[var(--danger)]/50 text-[var(--danger)]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
