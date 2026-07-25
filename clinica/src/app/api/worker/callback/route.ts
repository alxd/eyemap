import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cases } from "@/db/schema";
import {
  badRequest,
  MAX_ATTEMPTS,
  notFound,
  unauthorized,
  verifyWorkerSecret,
} from "@/lib/api";

const bodySchema = z.object({
  task_id: z.string().uuid(),
  status: z.enum(["done", "failed"]),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-worker-secret");
  if (!verifyWorkerSecret(secret)) return unauthorized("Invalid worker secret");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const { task_id, status, result, error } = parsed.data;

  const [existing] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, task_id))
    .limit(1);

  if (!existing) return notFound("Task not found");

  if (status === "failed") {
    const shouldRetry = existing.attempts < MAX_ATTEMPTS;
    const [updated] = await db
      .update(cases)
      .set({
        status: shouldRetry ? "queued" : "failed",
        error: error || "Worker reported failure",
        claimedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(cases.id, task_id))
      .returning();

    return NextResponse.json({
      caseId: updated.id,
      status: updated.status,
      requeued: shouldRetry,
    });
  }

  const [updated] = await db
    .update(cases)
    .set({
      status: "done",
      result: {
        ...(result || {}),
        completed_at:
          (result?.completed_at as string | undefined) ??
          new Date().toISOString(),
      },
      error: null,
      claimedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(cases.id, task_id))
    .returning();

  return NextResponse.json({
    caseId: updated.id,
    status: updated.status,
  });
}
