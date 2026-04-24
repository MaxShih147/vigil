"use server";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, BUCKET } from "@/lib/r2";

export async function getPresignedUrl(
  key: string,
  mode: "preview" | "download",
): Promise<string> {
  const filename = key.split("/").pop() ?? "video.mp4";
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentType: "video/mp4",
    ...(mode === "download" && {
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
  });
  return getSignedUrl(r2, cmd, { expiresIn: 3600 });
}
