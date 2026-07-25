import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cases, patients, users } from "@/db/schema";
import { notFound, requireSession, unauthorized } from "@/lib/api";
import { createPresignedGetUrl } from "@/lib/minio";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const { id } = await params;

  const [row] = await db
    .select({
      id: cases.id,
      status: cases.status,
      eye: cases.eye,
      imageKey: cases.imageKey,
      attempts: cases.attempts,
      error: cases.error,
      result: cases.result,
      createdAt: cases.createdAt,
      updatedAt: cases.updatedAt,
      claimedAt: cases.claimedAt,
      patientId: patients.id,
      patientRef: patients.externalRef,
      patientBirthYear: patients.birthYear,
      patientSex: patients.sex,
      patientNotes: patients.notes,
      doctorName: users.name,
      doctorEmail: users.email,
    })
    .from(cases)
    .innerJoin(patients, eq(cases.patientId, patients.id))
    .innerJoin(users, eq(cases.doctorId, users.id))
    .where(and(eq(cases.id, id), eq(cases.clinicId, session.user.clinicId)))
    .limit(1);

  if (!row) return notFound("Case not found");

  let imageUrl: string | null = null;
  if (row.imageKey) {
    try {
      imageUrl = await createPresignedGetUrl(row.imageKey);
    } catch {
      imageUrl = null;
    }
  }

  return NextResponse.json({ case: { ...row, imageUrl } });
}
