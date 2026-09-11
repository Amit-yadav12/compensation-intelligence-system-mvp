import { NextResponse } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { listCanonicalLevels } from "@/lib/services/reference.service";

export const GET = safeHandler(async () => {
  const data = await listCanonicalLevels();
  return NextResponse.json({ data });
});
