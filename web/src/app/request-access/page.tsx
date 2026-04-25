import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accessRequests } from "@/lib/db/schema";

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
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
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
      <main className="min-h-screen flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-teal mb-4">
            ✓ filed
          </div>
          <h1 className="font-bricolage text-3xl tracking-[-0.025em] mb-4">
            Your request has been logged.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            Max will review and notify you out-of-band. Once approved, return
            here and sign in with{" "}
            <span className="font-mono text-foreground">{email}</span>.
          </p>
          <a
            href="/signin"
            className="inline-block font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors border-b border-border/60 hover:border-foreground pb-1"
          >
            ← back to sign-in
          </a>
        </div>
      </main>
    );
  }

  const pending = email ? await alreadyPending(email) : false;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber mb-4">
          ◐ access · denied (pending review)
        </div>
        <h1 className="font-bricolage text-3xl tracking-[-0.025em] leading-tight mb-3">
          Request access to vigil.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          {email ? (
            <>
              <span className="font-mono text-foreground">{email}</span>{" "}
              isn&apos;t on the access list. Submit a request and Max will
              review it.
            </>
          ) : (
            "Tell Max who you are so he can grant access."
          )}
        </p>

        {pending ? (
          <div className="border border-border/60 bg-card/50 p-5 text-sm leading-relaxed">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber mb-2">
              already in queue
            </div>
            You have a pending request for{" "}
            <span className="font-mono text-foreground">{email}</span>. Sit
            tight — Max will reach out.
          </div>
        ) : (
          <form action={submit} className="space-y-5">
            <Field
              label="Email"
              hint="Google account you want access for"
              name="email"
              type="email"
              required
              defaultValue={email}
            />
            <Field
              label="Name"
              hint="Optional — what should Max call you?"
              name="name"
              type="text"
              defaultValue={name}
            />
            <Textarea
              label="Reason"
              hint="One line is plenty"
              name="reason"
              rows={3}
              placeholder="e.g. I need the printer-room footage from Tuesday."
            />
            <button
              type="submit"
              className="w-full bg-foreground text-background font-mono uppercase tracking-[0.2em] text-xs py-3.5 hover:bg-amber transition-colors"
            >
              Submit request →
            </button>
          </form>
        )}

        <a
          href="/signin"
          className="inline-block mt-8 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          ← back to sign-in
        </a>
      </div>
    </main>
  );
}

function Field(props: {
  label: string;
  hint?: string;
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {props.label}
        </span>
        {props.hint && (
          <span className="text-[10px] text-muted-foreground/60 italic">
            {props.hint}
          </span>
        )}
      </div>
      <input
        name={props.name}
        type={props.type}
        required={props.required}
        defaultValue={props.defaultValue}
        className="w-full bg-card border border-border focus:border-amber focus:ring-0 outline-none px-3 py-2.5 text-sm font-mono transition-colors"
      />
    </label>
  );
}

function Textarea(props: {
  label: string;
  hint?: string;
  name: string;
  rows: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {props.label}
        </span>
        {props.hint && (
          <span className="text-[10px] text-muted-foreground/60 italic">
            {props.hint}
          </span>
        )}
      </div>
      <textarea
        name={props.name}
        rows={props.rows}
        placeholder={props.placeholder}
        className="w-full bg-card border border-border focus:border-amber focus:ring-0 outline-none px-3 py-2.5 text-sm font-mono leading-relaxed transition-colors resize-none"
      />
    </label>
  );
}
