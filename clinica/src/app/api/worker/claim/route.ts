import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  MAX_ATTEMPTS,
  STUCK_PROCESSING_MS,
  unauthorized,
  verifyWorkerSecret,
} from "@/lib/api";
import { createInternalGetUrl, createPresignedGetUrl } from "@/lib/minio";

/**
 * Atomic claim of the oldest queued case.
 * Also re-queues cases stuck in `processing` past STUCK_PROCESSING_MS
 * (unless attempts >= MAX_ATTEMPTS, in which case they become failed).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-worker-secret");
  if (!verifyWorkerSecret(secret)) return unauthorized("Invalid worker secret");

  const stuckCutoff = new Date(Date.now() - STUCK_PROCESSING_MS);

  // Re-queue or fail stuck processing jobs
  await db.execute(sql`
    UPDATE cases
    SET
      status = CASE
        WHEN attempts >= ${MAX_ATTEMPTS} THEN 'failed'::case_status
        ELSE 'queued'::case_status
      END,
      error = CASE
        WHEN attempts >= ${MAX_ATTEMPTS} THEN 'Timed out while processing'
        ELSE error
      END,
      claimed_at = NULL,
      updated_at = NOW()
    WHERE status = 'processing'
      AND claimed_at IS NOT NULL
      AND claimed_at < ${stuckCutoff}
  `);

  // Prefer internal (localhost) URL when the worker is on the same machine.
  // Fall back to public Funnel URL if internal signing is not configured.
  const useInternal =
    (req.headers.get("x-worker-prefer-internal") || "true") === "true";

  const claimed = await db.execute(sql`
    UPDATE cases
    SET
      status = 'processing',
      claimed_at = NOW(),
      attempts = attempts + 1,
      updated_at = NOW()
    WHERE id = (
      SELECT id FROM cases
      WHERE status = 'queued'
        AND image_key IS NOT NULL
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, image_key, attempts, clinic_id, patient_id, eye
  `);

  const rows = claimed as unknown as Array<{
    id: string;
    image_key: string;
    attempts: number;
    clinic_id: string;
    patient_id: string;
    eye: string;
  }>;

  if (!rows.length) {
    return new NextResponse(null, { status: 204 });
  }

  const task = rows[0];
  let imageUrl: string;
  try {
    imageUrl = useInternal
      ? await createInternalGetUrl(task.image_key)
      : await createPresignedGetUrl(task.image_key);
  } catch {
    imageUrl = await createPresignedGetUrl(task.image_key);
  }

  return NextResponse.json({
    task: {
      task_id: task.id,
      image_key: task.image_key,
      image_url: imageUrl,
      attempts: task.attempts,
      clinic_id: task.clinic_id,
      patient_id: task.patient_id,
      eye: task.eye,
      timestamp: Math.floor(Date.now() / 1000),
    },
  });
}
