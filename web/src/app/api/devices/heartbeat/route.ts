import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { devices } from "@/lib/db/schema";
import { authDeviceRequest } from "@/lib/device-auth";
import { sql } from "drizzle-orm";

type HeartbeatBody = {
  device_id: string;
  label?: string;
  location?: string;
  recording?: boolean;
  disk_used_pct?: number;
  disk_free_gb?: number;
  pending_uploads?: number;
  last_upload_at?: string; // ISO
  ip?: string;
  vigil_version?: string;
};

export async function POST(req: NextRequest) {
  const unauth = authDeviceRequest(req);
  if (unauth) return unauth;

  let body: HeartbeatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!body.device_id || typeof body.device_id !== "string") {
    return NextResponse.json(
      { ok: false, error: "device_id required" },
      { status: 400 },
    );
  }

  const lastUpload = body.last_upload_at ? new Date(body.last_upload_at) : null;

  await db
    .insert(devices)
    .values({
      id: body.device_id,
      label: body.label ?? null,
      location: body.location ?? null,
      lastSeen: new Date(),
      recording: !!body.recording,
      diskUsedPct: body.disk_used_pct ?? null,
      diskFreeGb: body.disk_free_gb ?? null,
      pendingUploads: body.pending_uploads ?? null,
      lastUploadAt: lastUpload,
      ip: body.ip ?? null,
      vigilVersion: body.vigil_version ?? null,
    })
    .onConflictDoUpdate({
      target: devices.id,
      set: {
        label: sql`coalesce(excluded.label, ${devices.label})`,
        location: sql`coalesce(excluded.location, ${devices.location})`,
        lastSeen: sql`excluded.last_seen`,
        recording: sql`excluded.recording`,
        diskUsedPct: sql`excluded.disk_used_pct`,
        diskFreeGb: sql`excluded.disk_free_gb`,
        pendingUploads: sql`excluded.pending_uploads`,
        lastUploadAt: sql`coalesce(excluded.last_upload_at, ${devices.lastUploadAt})`,
        ip: sql`excluded.ip`,
        vigilVersion: sql`excluded.vigil_version`,
      },
    });

  return NextResponse.json({ ok: true });
}
