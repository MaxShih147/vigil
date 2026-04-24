import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2, BUCKET } from "./r2";

export type Recording = {
  key: string;
  device: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM:SS (parsed from filename)
  size: number;
  lastModified: string; // ISO string (serialisable to Client Components)
};

// Keys look like:   <device_id>/<YYYY>/<MM>/<DD>/vigil_<YYYY>-<MM>-<DD>_<HH>-<MM>-<SS>.mp4
// Falls back gracefully if a key doesn't match.
function parseKey(key: string, size: number, lastModified: Date): Recording | null {
  const parts = key.split("/");
  if (parts.length < 5) return null;
  const [device, year, month, day, name] = parts;
  const timeMatch = name.match(/_(\d{2})-(\d{2})-(\d{2})\.mp4$/);
  const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}` : "";
  return {
    key,
    device,
    date: `${year}-${month}-${day}`,
    time,
    size,
    lastModified: lastModified.toISOString(),
  };
}

export async function listRecordings(): Promise<Recording[]> {
  const out: Recording[] = [];
  let token: string | undefined;
  do {
    const res = await r2.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      const rec = parseKey(obj.Key, obj.Size ?? 0, obj.LastModified ?? new Date());
      if (rec) out.push(rec);
    }
    token = res.NextContinuationToken;
  } while (token);
  // newest first
  out.sort((a, b) => b.key.localeCompare(a.key));
  return out;
}
