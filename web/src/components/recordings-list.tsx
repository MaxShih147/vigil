"use client";

import { useState, useTransition } from "react";
import type { Recording } from "@/lib/recordings";
import { getPresignedUrl } from "@/app/actions";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

type Grouped = Map<string, Map<string, Recording[]>>;

function groupRecordings(recordings: Recording[]): Grouped {
  const byDate: Grouped = new Map();
  for (const r of recordings) {
    if (!byDate.has(r.date)) byDate.set(r.date, new Map());
    const devices = byDate.get(r.date)!;
    if (!devices.has(r.device)) devices.set(r.device, []);
    devices.get(r.device)!.push(r);
  }
  return byDate;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function RecordingsList({ recordings }: { recordings: Recording[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<Recording | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (recordings.length === 0) {
    return (
      <div className="border border-border/60 border-dashed rounded p-16 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 mb-4">
          archive · empty
        </div>
        <p className="font-bricolage text-2xl mb-3">No footage indexed yet.</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Once your Pi starts recording and the uploader ships its first
          segment, it&apos;ll appear here within ~10 minutes.
        </p>
      </div>
    );
  }

  const grouped = groupRecordings(recordings);

  function handlePreview(rec: Recording) {
    setPendingKey(rec.key);
    setPreviewUrl(null);
    setPreviewMeta(rec);
    startTransition(async () => {
      const url = await getPresignedUrl(rec.key, "preview");
      setPreviewUrl(url);
    });
  }

  async function handleDownload(rec: Recording) {
    const url = await getPresignedUrl(rec.key, "download");
    window.location.href = url;
  }

  return (
    <>
      <div className="space-y-12">
        {[...grouped.entries()].map(([date, byDevice]) => {
          const dateTotal = [...byDevice.values()].reduce(
            (n, arr) => n + arr.length,
            0,
          );
          const sizeTotal = [...byDevice.values()]
            .flat()
            .reduce((n, r) => n + r.size, 0);
          return (
            <section key={date}>
              <div className="flex items-baseline justify-between border-b border-border/60 pb-2 mb-1">
                <div className="flex items-baseline gap-4">
                  <h2 className="font-bricolage text-2xl tracking-tight">
                    {formatDate(date)}
                  </h2>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">
                    {date}
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
                  {dateTotal} {dateTotal === 1 ? "file" : "files"}
                  <span className="mx-2 text-muted-foreground/40">·</span>
                  {formatBytes(sizeTotal)}
                </span>
              </div>

              <ul className="divide-y divide-border/40">
                {[...byDevice.entries()].flatMap(([device, recs]) =>
                  recs.map((r) => (
                    <li
                      key={r.key}
                      className="group grid grid-cols-[auto_auto_1fr_auto_auto] gap-x-4 md:gap-x-6 items-center py-3 px-1 hover:bg-foreground/[0.02] transition-colors"
                    >
                      <span className="font-mono text-sm tabular-nums text-foreground">
                        {r.time || "—"}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 hidden sm:inline">
                        {device}
                      </span>
                      <span
                        aria-hidden
                        className="border-b border-dotted border-border/50 hidden md:block"
                      />
                      <span className="font-mono text-xs text-muted-foreground tabular-nums text-right">
                        {formatBytes(r.size)}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em]">
                        <button
                          type="button"
                          onClick={() => handlePreview(r)}
                          disabled={pending && pendingKey === r.key}
                          className="text-muted-foreground hover:text-amber transition-colors disabled:opacity-50"
                        >
                          {pending && pendingKey === r.key
                            ? "Loading…"
                            : "▸ Preview"}
                        </button>
                        <span className="text-border/60">·</span>
                        <button
                          type="button"
                          onClick={() => handleDownload(r)}
                          className="text-muted-foreground hover:text-teal transition-colors"
                        >
                          ↓ Download
                        </button>
                      </div>
                    </li>
                  )),
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {(previewUrl || (pending && pendingKey)) && (
        <div
          className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => {
            setPreviewUrl(null);
            setPreviewMeta(null);
            setPendingKey(null);
          }}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {previewMeta && (
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/80 mb-3 flex items-baseline gap-3">
                <span className="text-amber">●</span>
                <span>{previewMeta.device}</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{previewMeta.date}</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{previewMeta.time}</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{formatBytes(previewMeta.size)}</span>
              </div>
            )}
            {previewUrl ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                className="w-full rounded-sm border border-border shadow-2xl"
              />
            ) : (
              <div className="aspect-video bg-card border border-border rounded-sm flex items-center justify-center">
                <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
                  Preparing stream…
                </span>
              </div>
            )}
            <button
              type="button"
              className="absolute -top-3 -right-3 bg-foreground text-background rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-amber hover:text-background transition-colors"
              onClick={() => {
                setPreviewUrl(null);
                setPreviewMeta(null);
                setPendingKey(null);
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
