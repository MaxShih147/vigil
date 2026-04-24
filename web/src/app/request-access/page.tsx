import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accessRequests } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  email?: string;
  name?: string;
  submitted?: string;
}>;

async function alreadyPending(email: string): Promise<boolean> {
  if (!email) return false;
  const rows = await db
    .select({ id: accessRequests.id })
    .from(accessRequests)
    .where(
      and(
        eq(accessRequests.email, email),
        eq(accessRequests.status, "pending"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function submit(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!email) return;

  if (!(await alreadyPending(email))) {
    await db.insert(accessRequests).values({
      email,
      name: name || null,
      reason: reason || null,
    });
  }

  const params = new URLSearchParams({ submitted: "1", email });
  redirect(`/request-access?${params.toString()}`);
}

export default async function RequestAccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const email = params.email ?? "";
  const name = params.name ?? "";

  if (params.submitted) {
    return (
      <main className="container mx-auto max-w-md px-6 pt-32 text-center">
        <h1 className="text-2xl font-bold mb-3">Request received</h1>
        <p className="text-sm text-muted-foreground">
          Max will notify you once you&apos;re on the list. Then come back and
          sign in again with{" "}
          <span className="font-mono">{email}</span>.
        </p>
      </main>
    );
  }

  const pending = email ? await alreadyPending(email) : false;

  return (
    <main className="container mx-auto max-w-md px-6 pt-24">
      <h1 className="text-2xl font-bold mb-2">Request access to vigil</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {email
          ? `${email} isn't on the access list yet.`
          : "Tell Max who you are so he can grant access."}
      </p>

      {pending ? (
        <div className="border rounded-lg p-4 text-sm">
          You already have a pending request for{" "}
          <span className="font-mono">{email}</span>. Sit tight — Max will
          ping you.
        </div>
      ) : (
        <form action={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              defaultValue={email}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              name="name"
              type="text"
              defaultValue={name}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Why do you need access?
            </label>
            <textarea
              name="reason"
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="e.g. I'm Fred and I need the printer-room footage from last Tuesday."
            />
          </div>
          <Button type="submit" className="w-full">
            Submit request
          </Button>
        </form>
      )}
    </main>
  );
}
