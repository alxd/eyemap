import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { badRequest, requireSession, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const rows = await db
    .select()
    .from(patients)
    .where(eq(patients.clinicId, session.user.clinicId))
    .orderBy(desc(patients.createdAt))
    .limit(500);

  return NextResponse.json({ patients: rows });
}

const createSchema = z.object({
  externalRef: z.string().max(128).optional().nullable(),
  birthYear: z.number().int().min(1900).max(2100).optional().nullable(),
  sex: z.enum(["male", "female", "other", "unknown"]).default("unknown"),
  notes: z.string().max(2000).optional().nullable(),
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

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const [created] = await db
    .insert(patients)
    .values({
      clinicId: session.user.clinicId,
      externalRef: parsed.data.externalRef || null,
      birthYear: parsed.data.birthYear ?? null,
      sex: parsed.data.sex,
      notes: parsed.data.notes || null,
    })
    .returning();

  return NextResponse.json({ patient: created }, { status: 201 });
}
