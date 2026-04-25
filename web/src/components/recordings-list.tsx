"use client";

import { useState, useTransition } from "react";
import type { Recording } from "@/lib/recordings";
import { getPresignedUrl } from "@/app/actions";

function formatBytes(n: number): string {
  if (n < 1024) return `${n}_b`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)}_kb`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)}_mb`;
  return `${(n / 1024 ** 3).toFixed(2)}_gb`;
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

export function RecordingsList({ recordings }: { recordings: Recording[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<Recording | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (recordings.length === 0) {
    return (
      <div className="border border-phosphor/30 border-dashed p-16 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor-dim/70 mb-4">
          [ archive // empty ]
        </div>
        <p className="font-mono text-2xl mb-3 text-phosphor uppercase tracking-tight">
          NO_FOOTAGE_INDEXED
        </p>
        <p className="text-sm text-phosphor-dim max-w-md mx-auto leading-relaxed font-mono">
          &gt; once a node ships its first segment to r2, it will appear here
          within ~10 minutes.
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
              <div className="flex items-baseline justify-between border-b border-phosphor/30 pb-2 mb-1">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor-dim">
                    [ date ]
                  </span>
                  <h2 className="font-mono text-xl uppercase tracking-tight text-phosphor">
                    {date}
                  </h2>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-phosphor-dim/70">
                  {dateTotal} {dateTotal === 1 ? "file" : "files"}
                  <span className="mx-2 text-phosphor/30">::</span>
                  {formatBytes(sizeTotal)}
                </span>
              </div>

              <ul className="divide-y divide-phosphor/15">
                {[...byDevice.entries()].flatMap(([device, recs]) =>
                  recs.map((r) => (
                    <li
                      key={r.key}
                      className="group grid grid-cols-[auto_auto_1fr_auto_auto] gap-x-4 md:gap-x-6 items-center py-3 px-1 hover:bg-phosphor/[0.04] transition-colors"
                    >
                      <span className="font-mono text-sm tabular-nums text-phosphor">
                        {r.time || "—"}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-phosphor-dim/80 hidden sm:inline">
                        @{device}
                      </span>
                      <span
                        aria-hidden
                        className="border-b border-dotted border-phosphor/20 hidden md:block"
                      />
                      <span className="font-mono text-xs text-phosphor-dim tabular-nums text-right">
                        {formatBytes(r.size)}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em]">
                        <button
                          type="button"
                          onClick={() => handlePreview(r)}
                          disabled={pending && pendingKey === r.key}
                          className="text-phosphor-dim hover:text-phosphor transition-colors disabled:opacity-50"
                        >
                          {pending && pendingKey === r.key
                            ? "[loading]"
                            : "[play]"}
                        </button>
                        <span className="text-phosphor/30">::</span>
                        <button
                          type="button"
                          onClick={() => handleDownload(r)}
                          className="text-phosphor-dim hover:text-phosphor transition-colors"
                        >
                          [pull]
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
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor mb-3 flex items-baseline gap-3 glow">
                <span className="animate-tally">●</span>
                <span>@{previewMeta.device}</span>
                <span className="text-phosphor/40">::</span>
                <span>{previewMeta.date}</span>
                <span className="text-phosphor/40">::</span>
                <span>{previewMeta.time}</span>
                <span className="text-phosphor/40">::</span>
                <span>{formatBytes(previewMeta.size)}</span>
              </div>
            )}
            {previewUrl ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                className="w-full border border-phosphor/40 shadow-[0_0_60px_oklch(0.88_0.20_145_/_0.15)]"
              />
            ) : (
              <div className="aspect-video bg-card border border-phosphor/40 flex items-center justify-center">
                <span className="font-mono text-xs uppercase tracking-[0.3em] text-phosphor animate-pulse">
                  &gt; decoding stream
                </span>
              </div>
            )}
            <button
              type="button"
              className="absolute -top-3 -right-3 bg-phosphor text-background w-8 h-8 flex items-center justify-center font-mono font-bold hover:bg-warn transition-colors"
              onClick={() => {
                setPreviewUrl(null);
                setPreviewMeta(null);
                setPendingKey(null);
              }}
              aria-label="Close preview"
            >
              X
            </button>
          </div>
        </div>
      )}
    </>
  );
}
