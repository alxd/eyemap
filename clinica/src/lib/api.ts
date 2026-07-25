import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { auth } from "@/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id || !session.user.clinicId) {
    return null;
  }
  return session;
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Constant-time compare of the worker shared secret. */
export function verifyWorkerSecret(headerValue: string | null): boolean {
  const expected = process.env.WORKER_SHARED_SECRET;
  if (!expected || !headerValue) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(headerValue);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const STUCK_PROCESSING_MS = 30 * 60 * 1000; // 30 minutes
export const MAX_ATTEMPTS = 3;
