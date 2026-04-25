import { listRecordings } from "@/lib/recordings";
import { RecordingsList } from "@/components/recordings-list";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const recordings = await listRecordings();
  const deviceCount = new Set(recordings.map((r) => r.device)).size;
  const totalBytes = recordings.reduce((n, r) => n + r.size, 0);
  const totalGB = (totalBytes / 1024 ** 3).toFixed(2);

  const now = new Date();
  const utcStamp =
    now.toISOString().slice(0, 10) +
    "T" +
    now.toISOString().slice(11, 19) +
    "Z";

  return (
    <main className="container mx-auto max-w-6xl px-6 md:px-10 pt-10 pb-20">
      {/* Hero */}
      <header className="mb-16 relative">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-phosphor-dim mb-4">
          [ archive_node // 01 ]
        </div>
        <h1 className="font-mono text-5xl md:text-7xl font-bold tracking-[-0.04em] leading-[0.95] mb-4 glow uppercase">
          THE_RECORD<span className="animate-cursor"></span>
        </h1>
        <p className="text-phosphor-dim max-w-xl text-sm leading-relaxed mt-6 font-mono">
          &gt; edge nodes are recording. footage uploads continuously and indexes
          here in chronological order. select an entry to preview.
        </p>
      </header>

      {/* Status strip */}
      <div className="mb-12 border-y border-phosphor/30 py-4">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-8 font-mono text-xs">
          <Stat label="files_indexed" value={String(recordings.length)} accent />
          <Stat label="nodes_seen" value={String(deviceCount)} />
          <Stat label="bytes_stored" value={`${totalGB}_gb`} />
          <Stat label="utc_clock" value={utcStamp} mono />
        </dl>
      </div>

      <RecordingsList recordings={recordings} />
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.22em] text-phosphor-dim/70 mb-1">
        {label}
      </dt>
      <dd
        className={[
          "tabular-nums font-mono",
          mono ? "text-xs" : "text-2xl font-bold",
          accent ? "text-phosphor glow" : "text-phosphor",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
