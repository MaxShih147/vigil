import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { deviceCommands, devices } from "@/lib/db/schema";
import { queueCommand, type DeviceCommand } from "./actions";

export const dynamic = "force-dynamic";

type DeviceRow = typeof devices.$inferSelect;
type CommandRow = typeof deviceCommands.$inferSelect;

const ONLINE_THRESHOLD_MS = 30_000;     // < 30s since last heartbeat = online
const STALE_THRESHOLD_MS = 5 * 60_000;  // < 5min = stale, otherwise offline

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
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
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
        <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground/70 mb-3">
          Dept 03 · Device Roster
        </div>
        <h1 className="font-bricolage text-5xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95]">
          Eyes in the field.
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed mt-4">
          Each Pi reports state every {`${10}`}s. Commands queue here, and the
          device picks them up on its next poll.
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
    <div className="border border-border/60 border-dashed rounded p-16 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 mb-4">
        roster · empty
      </div>
      <p className="font-bricolage text-2xl mb-3">No devices have phoned home.</p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        Once you start <code className="font-mono text-xs">vigil-agent</code>{" "}
        on a Pi (and it can reach this dashboard), it&apos;ll appear here within
        ~10 seconds.
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
  const statusColor = {
    online: "text-teal",
    stale: "text-amber",
    offline: "text-warn",
  }[s];
  const statusLabel = {
    online: "online",
    stale: "stale",
    offline: "offline",
  }[s];
  const diskWarning =
    device.diskUsedPct !== null && device.diskUsedPct >= 85;

  return (
    <article className="border border-border/60 bg-card/40 backdrop-blur-sm">
      {/* Header strip */}
      <div className="border-b border-border/60 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-4">
          <span
            className={`text-base ${statusColor} ${
              s === "online" ? "animate-tally" : ""
            }`}
          >
            ●
          </span>
          <h2 className="font-bricolage text-2xl tracking-tight">
            {device.label || device.id}
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
            id · {device.id}
          </span>
          {device.location && (
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 hidden md:inline">
              loc · {device.location}
            </span>
          )}
        </div>
        <div
          className={`font-mono text-[10px] uppercase tracking-[0.3em] ${statusColor}`}
        >
          {statusLabel} · {relTime(device.lastSeen)}
        </div>
      </div>

      {/* Body grid */}
      <div className="grid md:grid-cols-[1fr_auto] gap-6 p-6">
        {/* Stats */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 font-mono text-xs">
          <Stat
            label="recording"
            value={device.recording ? "ACTIVE" : "idle"}
            tone={device.recording ? "amber" : "muted"}
          />
          <Stat
            label="disk used"
            value={device.diskUsedPct != null ? `${device.diskUsedPct}%` : "—"}
            tone={diskWarning ? "warn" : "default"}
          />
          <Stat
            label="disk free"
            value={
              device.diskFreeGb != null ? `${device.diskFreeGb} GB` : "—"
            }
          />
          <Stat
            label="pending uploads"
            value={
              device.pendingUploads != null
                ? String(device.pendingUploads)
                : "—"
            }
            tone={(device.pendingUploads ?? 0) > 5 ? "amber" : "default"}
          />
          <Stat label="last upload" value={relTime(device.lastUploadAt)} />
          <Stat label="ip" value={device.ip ?? "—"} />
          <Stat label="version" value={device.vigilVersion ?? "—"} />
          <Stat label="registered" value={relTime(device.registeredAt)} />
        </dl>

        {/* Command panel */}
        <div className="md:border-l md:border-border/60 md:pl-6 min-w-[180px]">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70 mb-3">
            command queue
          </div>
          <CommandButton deviceId={device.id} command="force_upload_now" label="Force upload" tone="primary" />
          <CommandButton deviceId={device.id} command="start_recording" label="Start recording" />
          <CommandButton deviceId={device.id} command="stop_recording" label="Stop recording" />
          <CommandButton deviceId={device.id} command="restart_recorder" label="Restart recorder" tone="muted" />
          <CommandButton deviceId={device.id} command="restart_uploader" label="Restart uploader" tone="muted" />
        </div>
      </div>

      {/* Recent command log */}
      {recentCommands.length > 0 && (
        <div className="border-t border-border/60 px-6 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70 mb-3">
            recent commands
          </div>
          <ul className="space-y-1.5 font-mono text-xs">
            {recentCommands.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[auto_auto_1fr_auto] gap-3 items-baseline"
              >
                <CommandStatus status={c.status} />
                <span className="text-foreground">{c.command}</span>
                <span className="text-muted-foreground/70 truncate">
                  {(c.result as { message?: string } | null)?.message ?? ""}
                </span>
                <span className="text-muted-foreground/60 text-[10px] uppercase tracking-[0.2em]">
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
  tone?: "default" | "amber" | "warn" | "muted";
}) {
  const colorClass =
    tone === "amber"
      ? "text-amber"
      : tone === "warn"
        ? "text-warn"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60 mb-1">
        {label}
      </dt>
      <dd className={`tabular-nums ${colorClass}`}>{value}</dd>
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
      ? "bg-foreground text-background hover:bg-amber"
      : tone === "muted"
        ? "border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground"
        : "border border-border/60 hover:border-foreground";
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
        → {label}
      </button>
    </form>
  );
}

function CommandStatus({ status }: { status: string }) {
  const map: Record<string, { dot: string; class: string }> = {
    pending: { dot: "○", class: "text-muted-foreground/60" },
    sent: { dot: "◐", class: "text-amber" },
    done: { dot: "●", class: "text-teal" },
    failed: { dot: "●", class: "text-warn" },
  };
  const v = map[status] ?? { dot: "?", class: "text-muted-foreground" };
  return (
    <span className={`text-xs uppercase tracking-[0.22em] ${v.class}`}>
      {v.dot} {status}
    </span>
  );
}
