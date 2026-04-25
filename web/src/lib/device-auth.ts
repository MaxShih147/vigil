import { NextRequest, NextResponse } from "next/server";

const DEVICE_API_KEY = process.env.VIGIL_DEVICE_API_KEY;

/**
 * Check the `Authorization: Bearer <key>` header against VIGIL_DEVICE_API_KEY.
 * Returns null on success, or a 401 NextResponse on failure.
 */
export function authDeviceRequest(req: NextRequest): NextResponse | null {
  if (!DEVICE_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "device api key not configured on server" },
      { status: 500 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1].trim() !== DEVICE_API_KEY) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}
