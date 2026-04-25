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
    " · " +
    now.toISOString().slice(11, 19) +
    " UTC";

  return (
    <main className="container mx-auto max-w-6xl px-6 md:px-10 pt-10 pb-20">
      {/* Hero */}
      <header className="mb-16 relative">
        <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground/70 mb-4">
          Dept 01 · The Vigil Record
        </div>
        <h1 className="font-bricolage text-6xl md:text-8xl font-semibold tracking-[-0.04em] leading-[0.95] mb-4">
          Edge recordings,
          <br />
          <span className="text-amber italic">indexed by hour.</span>
        </h1>
        <p className="text-muted-foreground max-w-xl text-base leading-relaxed mt-6">
          Footage from your devices is uploaded continuously and archived in
          chronological order. Preview or download any segment.
        </p>
      </header>

      {/* Status strip */}
      <div className="mb-12 border-y border-border/60 py-4">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-8 font-mono text-xs">
          <Stat label="recordings" value={String(recordings.length)} accent />
          <Stat label="devices online" value={String(deviceCount)} />
          <Stat label="total indexed" value={`${totalGB} gb`} />
          <Stat label="now" value={utcStamp} mono />
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
      <dt className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60 mb-1">
        {label}
      </dt>
      <dd
        className={[
          "tabular-nums",
          mono ? "text-xs" : "text-2xl",
          mono ? "" : "font-bricolage",
          accent ? "text-amber" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
