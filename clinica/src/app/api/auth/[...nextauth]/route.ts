import { NextResponse } from "next/server";
import { handlers } from "@/auth";

export const { GET, POST } = handlers;

// Ensure Auth.js never falls through without a response in edge cases
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
