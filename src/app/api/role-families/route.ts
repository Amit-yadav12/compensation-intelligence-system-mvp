import { NextResponse } from "next/server";
import { safeHandler } from "@/lib/api/errors";
import { listRoleFamilies } from "@/lib/services/reference.service";

export const GET = safeHandler(async () => {
  const data = await listRoleFamilies();
  return NextResponse.json({ data });
});
