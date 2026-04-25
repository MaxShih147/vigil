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
      <header className="mb-12 relative">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-phosphor-dim mb-3">
          [ control_node // 02 ]
        </div>
        <h1 className="font-mono text-4xl md:text-6xl font-bold tracking-[-0.04em] leading-[0.95] uppercase glow">
          ROSTER<span className="animate-cursor"></span>
        </h1>
        <p className="text-phosphor-dim max-w-xl text-sm leading-relaxed mt-4 font-mono">
          &gt; approve or revoke access. changes take effect on the user&apos;s
          next sign-in attempt.
        </p>
      </header>

      <section className="mb-16">
        <SectionHeader number="01" title="pending_requests" count={pending.length} />

        {pending.length === 0 ? (
          <Empty text="// no pending requests" />
        ) : (
          <ul className="border-y border-phosphor/30 divide-y divide-phosphor/15">
            {pending.map((req) => (
              <li key={req.id} className="py-5 grid md:grid-cols-[1fr_auto] gap-4 items-start">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="font-mono text-lg font-bold tracking-tight truncate text-phosphor">
                      {req.name || req.email}
                    </span>
                    {req.name && (
                      <span className="font-mono text-xs text-phosphor-dim truncate">
                        &lt;{req.email}&gt;
                      </span>
                    )}
                  </div>
                  {req.reason && (
                    <p className="text-sm text-phosphor-dim leading-relaxed mt-2 max-w-2xl font-mono">
                      &gt; {req.reason}
                    </p>
                  )}
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-phosphor-dim/70 mt-2">
                    [{new Date(req.requestedAt).toLocaleString()}]
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
                      className="bg-phosphor text-background px-4 py-2 hover:bg-background hover:text-phosphor border border-phosphor transition-colors font-bold"
                    >
                      [+] approve
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
                      className="text-phosphor-dim hover:text-warn transition-colors px-2 py-2"
                    >
                      [x] deny
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader number="02" title="allowed_emails" count={allowed.length} />

        {allowed.length === 0 ? (
          <Empty text="// nobody approved yet (admins auto-allowed via env var)" />
        ) : (
          <ul className="border-y border-phosphor/30 divide-y divide-phosphor/15">
            {allowed.map((row) => (
              <li
                key={row.email}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span className="text-phosphor text-xs">●</span>
                  <span className="font-mono text-sm truncate text-phosphor">
                    {row.email}
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-phosphor-dim/70">
                  <span className="hidden sm:inline">
                    [+{new Date(row.addedAt).toLocaleDateString()}]
                    {row.addedBy &&
                      ` by ${row.addedBy.split("@")[0]}`}
                  </span>
                  <form
                    action={async () => {
                      "use server";
                      await revokeAccess(row.email);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-phosphor-dim/70 hover:text-warn transition-colors"
                    >
                      [revoke]
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
}: {
  number: string;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-phosphor/30 pb-2 mb-1">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor">
          [§{number}]
        </span>
        <h2 className="font-mono text-xl uppercase tracking-tight text-phosphor">
          {title}
        </h2>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-phosphor-dim/70">
        {count} {count === 1 ? "entry" : "entries"}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-sm text-phosphor-dim/70 py-8 px-1 font-mono">{text}</p>
  );
}
