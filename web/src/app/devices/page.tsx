import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { deviceCommands, devices } from "@/lib/db/schema";
import { queueCommand, type DeviceCommand } from "./actions";

export const dynamic = "force-dynamic";

type DeviceRow = typeof devices.$inferSelect;
type CommandRow = typeof deviceCommands.$inferSelect;

const ONLINE_THRESHOLD_MS = 30_000;
const STALE_THRESHOLD_MS = 5 * 60_000;

function status(d: DeviceRow): "online" | "stale" | "offline" {
  if (!d.lastSeen) return "offline";
  const age = Date.now() - new Date(d.lastSeen).getTime();
  if (age < ONLINE_THRESHOLD_MS) return "online";
  if (age < STALE_THRESHOLD_MS) return "stale";
  return "offline";
}

function relTime(d: Date | string | null): string {
  if (!d) return "never";
  const t = new Date(d).getTime();
  const diff = Math.max(0, Date.now() - t);
  if (diff < 60_000) return `${Math.round(diff / 1000)}s_ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m_ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h_ago`;
  return `${Math.round(diff / 86_400_000)}d_ago`;
}

export default async function DevicesPage() {
  const allDevices = await db
    .select()
    .from(devices)
    .orderBy(desc(devices.lastSeen));

  const recentCommandsByDevice = new Map<string, CommandRow[]>();
  for (const d of allDevices) {
    const cmds = await db
      .select()
      .from(deviceCommands)
      .where(eq(deviceCommands.deviceId, d.id))
      .orderBy(desc(deviceCommands.createdAt))
      .limit(5);
    recentCommandsByDevice.set(d.id, cmds);
  }

  return (
    <main className="container mx-auto max-w-6xl px-6 md:px-10 pt-10 pb-20">
      <header className="mb-12 relative">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-phosphor-dim mb-3">
          [ control_node // 03 ]
        </div>
        <h1 className="font-mono text-4xl md:text-6xl font-bold tracking-[-0.04em] leading-[0.95] uppercase glow">
          NODES<span className="animate-cursor"></span>
        </h1>
        <p className="text-phosphor-dim max-w-xl text-sm leading-relaxed mt-4 font-mono">
          &gt; each node reports state every 10s. commands queue here. node
          picks them up on next poll.
        </p>
      </header>

      {allDevices.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {allDevices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              recentCommands={recentCommandsByDevice.get(d.id) ?? []}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border border-phosphor/30 border-dashed p-16 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor-dim/70 mb-4">
        [ roster // empty ]
      </div>
      <p className="font-mono text-2xl font-bold uppercase tracking-tight text-phosphor mb-3">
        NO_NODES_REPORTING
      </p>
      <p className="text-sm text-phosphor-dim max-w-md mx-auto leading-relaxed font-mono">
        &gt; start <span className="text-phosphor">vigil-agent</span> on a node.
        if it can reach this dashboard, it will appear here within ~10s.
      </p>
    </div>
  );
}

function DeviceCard({
  device,
  recentCommands,
}: {
  device: DeviceRow;
  recentCommands: CommandRow[];
}) {
  const s = status(device);
  const statusColorClass = {
    online: "text-phosphor",
    stale: "text-phosphor-dim",
    offline: "text-warn",
  }[s];
  const statusLabel = { online: "online", stale: "stale", offline: "offline" }[s];
  const diskWarning =
    device.diskUsedPct !== null && device.diskUsedPct >= 85;

  return (
    <article className="border border-phosphor/40 bg-card/40 backdrop-blur-sm">
      <div className="border-b border-phosphor/30 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-4">
          <span
            className={`text-base ${statusColorClass} ${
              s === "online" ? "animate-tally" : ""
            }`}
          >
            ●
          </span>
          <h2 className="font-mono text-xl font-bold tracking-tight uppercase text-phosphor">
            {device.label || device.id}
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-phosphor-dim/80">
            id::{device.id}
          </span>
          {device.location && (
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-phosphor-dim/80 hidden md:inline">
              loc::{device.location}
            </span>
          )}
        </div>
        <div
          className={`font-mono text-[10px] uppercase tracking-[0.3em] ${statusColorClass}`}
        >
          [{statusLabel}] {relTime(device.lastSeen)}
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-6 p-6">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 font-mono text-xs">
          <Stat
            label="recording"
            value={device.recording ? "ACTIVE" : "idle"}
            tone={device.recording ? "phosphor" : "muted"}
          />
          <Stat
            label="disk_used"
            value={device.diskUsedPct != null ? `${device.diskUsedPct}%` : "—"}
            tone={diskWarning ? "warn" : "default"}
          />
          <Stat
            label="disk_free"
            value={device.diskFreeGb != null ? `${device.diskFreeGb}_gb` : "—"}
          />
          <Stat
            label="pending_uploads"
            value={
              device.pendingUploads != null ? String(device.pendingUploads) : "—"
            }
            tone={(device.pendingUploads ?? 0) > 5 ? "phosphor" : "default"}
          />
          <Stat label="last_upload" value={relTime(device.lastUploadAt)} />
          <Stat label="ip" value={device.ip ?? "—"} />
          <Stat label="version" value={device.vigilVersion ?? "—"} />
          <Stat label="registered" value={relTime(device.registeredAt)} />
        </dl>

        <div className="md:border-l md:border-phosphor/30 md:pl-6 min-w-[180px]">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor-dim/80 mb-3">
            [ command_queue ]
          </div>
          <CommandButton deviceId={device.id} command="force_upload_now" label="force_upload" tone="primary" />
          <CommandButton deviceId={device.id} command="start_recording" label="start_record" />
          <CommandButton deviceId={device.id} command="stop_recording" label="stop_record" />
          <CommandButton deviceId={device.id} command="restart_recorder" label="restart_recorder" tone="muted" />
          <CommandButton deviceId={device.id} command="restart_uploader" label="restart_uploader" tone="muted" />
        </div>
      </div>

      {recentCommands.length > 0 && (
        <div className="border-t border-phosphor/30 px-6 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor-dim/80 mb-3">
            [ recent_log ]
          </div>
          <ul className="space-y-1.5 font-mono text-xs">
            {recentCommands.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[auto_auto_1fr_auto] gap-3 items-baseline"
              >
                <CommandStatus status={c.status} />
                <span className="text-phosphor">{c.command}</span>
                <span className="text-phosphor-dim/70 truncate">
                  {(c.result as { message?: string } | null)?.message ?? ""}
                </span>
                <span className="text-phosphor-dim/70 text-[10px] uppercase tracking-[0.2em]">
                  {relTime(c.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "phosphor" | "warn" | "muted";
}) {
  const colorClass =
    tone === "phosphor"
      ? "text-phosphor glow"
      : tone === "warn"
        ? "text-warn"
        : tone === "muted"
          ? "text-phosphor-dim"
          : "text-phosphor";
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.22em] text-phosphor-dim/70 mb-1">
        {label}
      </dt>
      <dd className={`tabular-nums font-mono ${colorClass}`}>{value}</dd>
    </div>
  );
}

function CommandButton({
  deviceId,
  command,
  label,
  tone = "default",
}: {
  deviceId: string;
  command: DeviceCommand;
  label: string;
  tone?: "default" | "primary" | "muted";
}) {
  const cls =
    tone === "primary"
      ? "bg-phosphor text-background hover:bg-background hover:text-phosphor border border-phosphor font-bold"
      : tone === "muted"
        ? "border border-phosphor/30 text-phosphor-dim hover:text-phosphor hover:border-phosphor"
        : "border border-phosphor/40 text-phosphor hover:bg-phosphor/10";
  return (
    <form
      action={async () => {
        "use server";
        await queueCommand(deviceId, command);
      }}
    >
      <button
        type="submit"
        className={`block w-full font-mono text-[10px] uppercase tracking-[0.22em] py-2 px-3 mb-2 transition-colors ${cls}`}
      >
        &gt; {label}
      </button>
    </form>
  );
}

function CommandStatus({ status }: { status: string }) {
  const map: Record<string, { dot: string; class: string }> = {
    pending: { dot: "○", class: "text-phosphor-dim/70" },
    sent: { dot: "◐", class: "text-phosphor-dim" },
    done: { dot: "●", class: "text-phosphor glow" },
    failed: { dot: "●", class: "text-warn" },
  };
  const v = map[status] ?? { dot: "?", class: "text-phosphor-dim" };
  return (
    <span className={`text-xs uppercase tracking-[0.22em] ${v.class}`}>
      {v.dot} {status}
    </span>
  );
}
