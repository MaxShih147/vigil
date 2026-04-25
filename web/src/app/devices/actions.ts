"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { deviceCommands } from "@/lib/db/schema";

const ALLOWED_COMMANDS = [
  "start_recording",
  "stop_recording",
  "restart_recorder",
  "restart_uploader",
  "force_upload_now",
] as const;

export type DeviceCommand = (typeof ALLOWED_COMMANDS)[number];

export async function queueCommand(
  deviceId: string,
  command: DeviceCommand,
): Promise<void> {
  const session = await auth();
  const issuedBy = session?.user?.email;
  if (!issuedBy) throw new Error("forbidden");
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(`unknown command: ${command}`);
  }

  await db.insert(deviceCommands).values({
    deviceId,
    command,
    issuedBy,
  });

  revalidatePath("/devices");
}
