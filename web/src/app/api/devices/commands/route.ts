import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { deviceCommands } from "@/lib/db/schema";
import { authDeviceRequest } from "@/lib/device-auth";

/**
 * Pi pulls its pending commands here. We mark them `sent` atomically so the
 * same command isn't dispatched twice.
 */
export async function GET(req: NextRequest) {
  const unauth = authDeviceRequest(req);
  if (unauth) return unauth;

  const deviceId = req.nextUrl.searchParams.get("device_id");
  if (!deviceId) {
    return NextResponse.json(
      { ok: false, error: "device_id query param required" },
      { status: 400 },
    );
  }

  const pending = await db
    .select()
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.deviceId, deviceId),
        eq(deviceCommands.status, "pending"),
      ),
    )
    .orderBy(deviceCommands.createdAt);

  if (pending.length > 0) {
    await db
      .update(deviceCommands)
      .set({ status: "sent", sentAt: new Date() })
      .where(
        inArray(
          deviceCommands.id,
          pending.map((c) => c.id),
        ),
      );
  }

  return NextResponse.json({
    ok: true,
    commands: pending.map((c) => ({
      id: c.id,
      command: c.command,
      payload: c.payload,
    })),
  });
}
