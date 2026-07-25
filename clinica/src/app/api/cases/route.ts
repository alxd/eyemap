import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cases, patients, users } from "@/db/schema";
import { requireSession, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const rows = await db
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
      patientId: patients.id,
      patientRef: patients.externalRef,
      patientBirthYear: patients.birthYear,
      patientSex: patients.sex,
      doctorName: users.name,
    })
    .from(cases)
    .innerJoin(patients, eq(cases.patientId, patients.id))
    .innerJoin(users, eq(cases.doctorId, users.id))
    .where(eq(cases.clinicId, session.user.clinicId))
    .orderBy(desc(cases.createdAt))
    .limit(200);

  return NextResponse.json({ cases: rows });
}
