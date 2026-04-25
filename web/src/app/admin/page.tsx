import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accessRequests, allowedEmails } from "@/lib/db/schema";
import {
  approveRequest,
  denyRequest,
  revokeAccess,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [pending, allowed] = await Promise.all([
    db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.status, "pending"))
      .orderBy(desc(accessRequests.requestedAt)),
    db
      .select()
      .from(allowedEmails)
      .orderBy(desc(allowedEmails.addedAt)),
  ]);

  return (
    <main className="container mx-auto max-w-4xl px-6 md:px-10 pt-10 pb-20">
      {/* Hero */}
      <header className="mb-12 relative">
        <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground/70 mb-3">
          Dept 02 · Access Control
        </div>
        <h1 className="font-bricolage text-5xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95]">
          The roster.
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed mt-4">
          Approve or revoke access. Approvals take effect on the user&apos;s
          next sign-in attempt.
        </p>
      </header>

      {/* Pending */}
      <section className="mb-16">
        <SectionHeader
          number="01"
          title="Pending requests"
          count={pending.length}
          accent="amber"
        />

        {pending.length === 0 ? (
          <Empty text="No pending requests." />
        ) : (
          <ul className="border-y border-border/60 divide-y divide-border/40">
            {pending.map((req) => (
              <li key={req.id} className="py-5 grid md:grid-cols-[1fr_auto] gap-4 items-start">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="font-bricolage text-lg font-medium tracking-tight truncate">
                      {req.name || req.email}
                    </span>
                    {req.name && (
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        {req.email}
                      </span>
                    )}
                  </div>
                  {req.reason && (
                    <p className="text-sm text-muted-foreground italic leading-relaxed mt-2 max-w-2xl">
                      &ldquo;{req.reason}&rdquo;
                    </p>
                  )}
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60 mt-2">
                    {new Date(req.requestedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em]">
                  <form
                    action={async () => {
                      "use server";
                      await approveRequest(req.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="bg-foreground text-background px-4 py-2 hover:bg-teal transition-colors"
                    >
                      ✓ Approve
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await denyRequest(req.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-muted-foreground hover:text-warn transition-colors px-2 py-2"
                    >
                      ✗ Deny
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Allowed */}
      <section>
        <SectionHeader
          number="02"
          title="Allowed emails"
          count={allowed.length}
          accent="teal"
        />

        {allowed.length === 0 ? (
          <Empty text="Nobody approved yet (admin emails are auto-allowed via env var)." />
        ) : (
          <ul className="border-y border-border/60 divide-y divide-border/40">
            {allowed.map((row) => (
              <li
                key={row.email}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span className="text-teal text-xs">●</span>
                  <span className="font-mono text-sm truncate">
                    {row.email}
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                  <span className="hidden sm:inline">
                    added {new Date(row.addedAt).toLocaleDateString()}
                    {row.addedBy &&
                      `  · by ${row.addedBy.split("@")[0]}`}
                  </span>
                  <form
                    action={async () => {
                      "use server";
                      await revokeAccess(row.email);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-muted-foreground/60 hover:text-warn transition-colors"
                    >
                      Revoke
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SectionHeader({
  number,
  title,
  count,
  accent,
}: {
  number: string;
  title: string;
  count: number;
  accent: "amber" | "teal";
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 pb-2 mb-1">
      <div className="flex items-baseline gap-4">
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.3em] ${
            accent === "amber" ? "text-amber" : "text-teal"
          }`}
        >
          §{number}
        </span>
        <h2 className="font-bricolage text-2xl tracking-tight">{title}</h2>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
        {count} {count === 1 ? "entry" : "entries"}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-sm text-muted-foreground/70 italic py-8 px-1">{text}</p>
  );
}
