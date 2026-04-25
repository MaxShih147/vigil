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
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor mb-4 glow">
            [ ✓ request_logged ]
          </div>
          <h1 className="font-mono text-3xl font-bold uppercase tracking-tight mb-4 glow">
            QUEUED
          </h1>
          <p className="text-sm text-phosphor-dim leading-relaxed mb-8 font-mono">
            &gt; admin will review and notify you out-of-band.<br />
            &gt; once approved, return and sign in with{" "}
            <span className="text-phosphor">{email}</span>.
          </p>
          <a
            href="/signin"
            className="inline-block font-mono text-[10px] uppercase tracking-[0.25em] text-phosphor-dim hover:text-phosphor transition-colors border-b border-phosphor/40 hover:border-phosphor pb-1"
          >
            &lt;&lt; back_to_signin
          </a>
        </div>
      </main>
    );
  }

  const pending = email ? await alreadyPending(email) : false;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-warn mb-4">
          [ access // denied — pending review ]
        </div>
        <h1 className="font-mono text-3xl font-bold uppercase tracking-tight leading-tight mb-3 glow">
          REQUEST_ACCESS
        </h1>
        <p className="text-sm text-phosphor-dim leading-relaxed mb-8 font-mono">
          {email ? (
            <>
              &gt; <span className="text-phosphor">{email}</span> not in
              allowlist. submit request below for admin review.
            </>
          ) : (
            "> identify yourself for admin review."
          )}
        </p>

        {pending ? (
          <div className="border border-phosphor/40 bg-card p-5 text-sm leading-relaxed font-mono">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-phosphor mb-2">
              [ already_in_queue ]
            </div>
            &gt; pending request exists for{" "}
            <span className="text-phosphor">{email}</span>. await admin.
          </div>
        ) : (
          <form action={submit} className="space-y-5">
            <Field
              label="email"
              hint="// google account"
              name="email"
              type="email"
              required
              defaultValue={email}
            />
            <Field
              label="name"
              hint="// optional"
              name="name"
              type="text"
              defaultValue={name}
            />
            <Textarea
              label="reason"
              hint="// one line is plenty"
              name="reason"
              rows={3}
              placeholder="> printer-room footage from tuesday."
            />
            <button
              type="submit"
              className="w-full bg-phosphor text-background font-mono uppercase tracking-[0.2em] text-xs py-3.5 hover:bg-background hover:text-phosphor border border-phosphor transition-colors font-bold"
            >
              &gt; submit_request
            </button>
          </form>
        )}

        <a
          href="/signin"
          className="inline-block mt-8 font-mono text-[10px] uppercase tracking-[0.25em] text-phosphor-dim/70 hover:text-phosphor transition-colors"
        >
          &lt;&lt; back_to_signin
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
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-phosphor">
          {props.label}
        </span>
        {props.hint && (
          <span className="text-[10px] text-phosphor-dim/70 font-mono">
            {props.hint}
          </span>
        )}
      </div>
      <input
        name={props.name}
        type={props.type}
        required={props.required}
        defaultValue={props.defaultValue}
        className="w-full bg-card border border-phosphor/40 focus:border-phosphor focus:ring-0 outline-none px-3 py-2.5 text-sm font-mono text-phosphor transition-colors"
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
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-phosphor">
          {props.label}
        </span>
        {props.hint && (
          <span className="text-[10px] text-phosphor-dim/70 font-mono">
            {props.hint}
          </span>
        )}
      </div>
      <textarea
        name={props.name}
        rows={props.rows}
        placeholder={props.placeholder}
        className="w-full bg-card border border-phosphor/40 focus:border-phosphor focus:ring-0 outline-none px-3 py-2.5 text-sm font-mono text-phosphor leading-relaxed transition-colors resize-none"
      />
    </label>
  );
}
