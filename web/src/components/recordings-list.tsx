"use client";

import { useState, useTransition } from "react";
import type { Recording } from "@/lib/recordings";
import { getPresignedUrl } from "@/app/actions";
import { Button } from "@/components/ui/button";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

type Grouped = Map<string, Map<string, Recording[]>>;

function groupRecordings(recordings: Recording[]): Grouped {
  const byDevice: Grouped = new Map();
  for (const r of recordings) {
    if (!byDevice.has(r.device)) byDevice.set(r.device, new Map());
    const dates = byDevice.get(r.device)!;
    if (!dates.has(r.date)) dates.set(r.date, []);
    dates.get(r.date)!.push(r);
  }
  return byDevice;
}

export function RecordingsList({ recordings }: { recordings: Recording[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (recordings.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground">
        <p className="mb-2 font-medium">No recordings yet</p>
        <p className="text-sm">
          Start the Pi recorder + uploader — they&apos;ll appear here within{" "}
          <code className="font-mono text-xs">segment_seconds + stability_grace_seconds</code>.
        </p>
      </div>
    );
  }

  const grouped = groupRecordings(recordings);

  function handlePreview(key: string) {
    setPreviewKey(key);
    setPreviewUrl(null);
    startTransition(async () => {
      const url = await getPresignedUrl(key, "preview");
      setPreviewUrl(url);
    });
  }

  async function handleDownload(key: string) {
    const url = await getPresignedUrl(key, "download");
    window.location.href = url;
  }

  return (
    <>
      <div className="space-y-8">
        {[...grouped.entries()].map(([device, dates]) => (
          <section key={device}>
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-xl font-semibold">{device}</h2>
              <span className="text-sm text-muted-foreground">
                {[...dates.values()].reduce((n, arr) => n + arr.length, 0)} recordings
              </span>
            </div>
            <div className="space-y-4">
              {[...dates.entries()].map(([date, recs]) => (
                <div key={date} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/40 px-4 py-2 border-b flex items-baseline justify-between">
                    <h3 className="font-medium">{date}</h3>
                    <span className="text-xs text-muted-foreground">
                      {recs.length} file{recs.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="divide-y">
                    {recs.map((r) => (
                      <li
                        key={r.key}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/20"
                      >
                        <div className="flex flex-col">
                          <span className="font-mono text-sm">{r.time || "—"}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(r.size)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreview(r.key)}
                            disabled={pending && previewKey === r.key}
                          >
                            {pending && previewKey === r.key ? "Loading…" : "Preview"}
                          </Button>
                          <Button size="sm" onClick={() => handleDownload(r.key)}>
                            Download
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setPreviewUrl(null);
            setPreviewKey(null);
          }}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={previewUrl}
              controls
              autoPlay
              className="w-full rounded-lg shadow-2xl"
            />
            <button
              className="absolute -top-2 -right-2 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-gray-100"
              onClick={() => {
                setPreviewUrl(null);
                setPreviewKey(null);
              }}
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
