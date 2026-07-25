import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cases } from "@/db/schema";
import { badRequest, notFound, requireSession, unauthorized } from "@/lib/api";

const bodySchema = z.object({
  caseId: z.string().uuid(),
});

/**
 * Called by the browser after a successful PUT to the MinIO presigned URL.
 * Moves the case from pending_upload -> queued so the GPU worker can claim it.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("caseId is required");
  }

  const [caseRow] = await db
    .select()
    .from(cases)
    .where(
      and(
        eq(cases.id, parsed.data.caseId),
        eq(cases.clinicId, session.user.clinicId),
      ),
    )
    .limit(1);

  if (!caseRow) return notFound("Case not found");
  if (!caseRow.imageKey) return badRequest("Case has no image key");

  if (caseRow.status !== "pending_upload" && caseRow.status !== "failed") {
    return NextResponse.json({
      caseId: caseRow.id,
      status: caseRow.status,
      message: "Already queued or processed",
    });
  }

  const [updated] = await db
    .update(cases)
    .set({
      status: "queued",
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(cases.id, caseRow.id))
    .returning();

  return NextResponse.json(
    {
      caseId: updated.id,
      status: updated.status,
      task_id: updated.id,
      image_url: updated.imageKey,
      timestamp: Math.floor(Date.now() / 1000),
    },
    { status: 202 },
  );
}
