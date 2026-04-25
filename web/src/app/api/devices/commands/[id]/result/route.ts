import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { deviceCommands } from "@/lib/db/schema";
import { authDeviceRequest } from "@/lib/device-auth";

type ResultBody = {
  ok: boolean;
  message?: string;
  data?: unknown;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const unauth = authDeviceRequest(req);
  if (unauth) return unauth;

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json(
      { ok: false, error: "id must be numeric" },
      { status: 400 },
    );
  }

  let body: ResultBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 },
    );
  }

  await db
    .update(deviceCommands)
    .set({
      status: body.ok ? "done" : "failed",
      result: body as unknown as Record<string, unknown>,
      doneAt: new Date(),
    })
    .where(eq(deviceCommands.id, id));

  return NextResponse.json({ ok: true });
}
