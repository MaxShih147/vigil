import { listRecordings } from "@/lib/recordings";
import { RecordingsList } from "@/components/recordings-list";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const recordings = await listRecordings();
  const deviceCount = new Set(recordings.map((r) => r.device)).size;
  const totalBytes = recordings.reduce((n, r) => n + r.size, 0);
  const totalGB = (totalBytes / 1024 ** 3).toFixed(2);

  return (
    <main className="container mx-auto max-w-5xl p-6 md:p-10">
      <header className="mb-8 pb-6 border-b">
        <h1 className="text-3xl font-bold tracking-tight">vigil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {recordings.length} recording{recordings.length === 1 ? "" : "s"}
          {" · "}
          {deviceCount} device{deviceCount === 1 ? "" : "s"}
          {" · "}
          {totalGB} GB total
        </p>
      </header>
      <RecordingsList recordings={recordings} />
    </main>
  );
}
