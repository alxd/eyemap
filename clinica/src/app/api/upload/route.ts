import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cases, patients } from "@/db/schema";
import {
  badRequest,
  requireSession,
  unauthorized,
} from "@/lib/api";
import { buildCaseImageKey, createPresignedPutUrl } from "@/lib/minio";

const bodySchema = z.object({
  patientId: z.string().uuid().optional(),
  externalRef: z.string().max(128).optional(),
  birthYear: z.number().int().min(1900).max(2100).optional().nullable(),
  sex: z.enum(["male", "female", "other", "unknown"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
  eye: z.enum(["L", "R", "both", "unknown"]).default("unknown"),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128).default("image/jpeg"),
});

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
    return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const data = parsed.data;
  const clinicId = session.user.clinicId;
  const doctorId = session.user.id;

  let patientId = data.patientId;

  if (patientId) {
    const [existing] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);
    if (!existing || existing.clinicId !== clinicId) {
      return badRequest("Patient not found in your clinic");
    }
  } else {
    const [created] = await db
      .insert(patients)
      .values({
        clinicId,
        externalRef: data.externalRef || null,
        birthYear: data.birthYear ?? null,
        sex: data.sex || "unknown",
        notes: data.notes || null,
      })
      .returning();
    patientId = created.id;
  }

  const [caseRow] = await db
    .insert(cases)
    .values({
      patientId,
      doctorId,
      clinicId,
      eye: data.eye,
      status: "pending_upload",
    })
    .returning();

  const imageKey = buildCaseImageKey(clinicId, caseRow.id, data.filename);

  await db
    .update(cases)
    .set({ imageKey, updatedAt: new Date() })
    .where(eq(cases.id, caseRow.id));

  const uploadUrl = await createPresignedPutUrl(imageKey);

  return NextResponse.json(
    {
      caseId: caseRow.id,
      patientId,
      imageKey,
      uploadUrl,
      contentType: data.contentType,
    },
    { status: 201 },
  );
}
