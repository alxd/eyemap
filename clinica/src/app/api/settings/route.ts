import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clinics } from "@/db/schema";
import { badRequest, requireSession, unauthorized } from "@/lib/api";
import {
  AVAILABLE_MODELS,
  DEFAULT_ENABLED_MODELS,
  normalizeModelIds,
} from "@/lib/models";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const [clinic] = await db
    .select()
    .from(clinics)
    .where(eq(clinics.id, session.user.clinicId))
    .limit(1);

  if (!clinic) return badRequest("Clinică negăsită");

  const enabledModels = normalizeModelIds(clinic.settings?.enabledModels);

  return NextResponse.json({
    clinic: { id: clinic.id, name: clinic.name, city: clinic.city },
    availableModels: AVAILABLE_MODELS,
    enabledModels,
  });
}

const putSchema = z.object({
  enabledModels: z.array(z.string()).min(1),
});

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return badRequest("JSON invalid");
  }

  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest("Selectați cel puțin un model");
  }

  const enabledModels = normalizeModelIds(parsed.data.enabledModels);
  if (!enabledModels.length) {
    return badRequest("Selectați cel puțin un model valid");
  }

  const [updated] = await db
    .update(clinics)
    .set({
      settings: { enabledModels },
    })
    .where(eq(clinics.id, session.user.clinicId))
    .returning();

  return NextResponse.json({
    enabledModels: normalizeModelIds(updated.settings?.enabledModels),
  });
}

export { DEFAULT_ENABLED_MODELS };
