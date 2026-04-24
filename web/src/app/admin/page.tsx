import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accessRequests, allowedEmails } from "@/lib/db/schema";
import {
  approveRequest,
  denyRequest,
  revokeAccess,
} from "./actions";
import { Button } from "@/components/ui/button";

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
    <main className="container mx-auto max-w-3xl p-6 md:p-10 space-y-12">
      <header className="pb-6 border-b">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage who can sign in to vigil.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-3">
          Pending requests
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {pending.length}
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((req) => (
              <li
                key={req.id}
                className="border rounded-lg p-4 flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{req.name || req.email}</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {req.email}
                  </div>
                  {req.reason && (
                    <p className="text-sm mt-2 italic break-words">
                      &ldquo;{req.reason}&rdquo;
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(req.requestedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <form
                    action={async () => {
                      "use server";
                      await approveRequest(req.id);
                    }}
                  >
                    <Button type="submit" size="sm">
                      Approve
                    </Button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await denyRequest(req.id);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      Deny
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">
          Allowed emails
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {allowed.length}
          </span>
        </h2>
        {allowed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody approved yet (besides admin via env var).
          </p>
        ) : (
          <ul className="border rounded-lg divide-y">
            {allowed.map((row) => (
              <li
                key={row.email}
                className="flex items-center justify-between px-4 py-2"
              >
                <div>
                  <div className="font-mono text-sm">{row.email}</div>
                  <div className="text-xs text-muted-foreground">
                    added {new Date(row.addedAt).toLocaleDateString()}
                    {row.addedBy && ` · by ${row.addedBy}`}
                  </div>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await revokeAccess(row.email);
                  }}
                >
                  <Button type="submit" size="sm" variant="ghost">
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
