"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { accessRequests, allowedEmails } from "@/lib/db/schema";

async function requireAdmin(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email;
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;
  if (!email || !isAdmin) throw new Error("forbidden");
  return email;
}

export async function approveRequest(id: number): Promise<void> {
  const adminEmail = await requireAdmin();
  const [req] = await db
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.id, id))
    .limit(1);
  if (!req) return;

  await db
    .insert(allowedEmails)
    .values({ email: req.email, addedBy: adminEmail })
    .onConflictDoNothing();

  await db
    .update(accessRequests)
    .set({ status: "approved", decidedAt: new Date(), decidedBy: adminEmail })
    .where(eq(accessRequests.id, id));

  revalidatePath("/admin");
}

export async function denyRequest(id: number): Promise<void> {
  const adminEmail = await requireAdmin();
  await db
    .update(accessRequests)
    .set({ status: "denied", decidedAt: new Date(), decidedBy: adminEmail })
    .where(eq(accessRequests.id, id));
  revalidatePath("/admin");
}

export async function revokeAccess(email: string): Promise<void> {
  await requireAdmin();
  await db.delete(allowedEmails).where(eq(allowedEmails.email, email));
  revalidatePath("/admin");
}
