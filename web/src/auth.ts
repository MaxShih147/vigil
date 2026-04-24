import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db/client";
import { allowedEmails } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}

async function isAllowed(email: string): Promise<boolean> {
  if (isAdmin(email)) return true;
  const rows = await db
    .select({ email: allowedEmails.email })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email))
    .limit(1);
  return rows.length > 0;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (await isAllowed(user.email)) return true;
      // Not on the allowlist — bounce to the request-access page with their info pre-filled.
      const params = new URLSearchParams({ email: user.email });
      if (user.name) params.set("name", user.name);
      return `/request-access?${params.toString()}`;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
        token.isAdmin = isAdmin(user.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? session.user.email;
        (session.user as { isAdmin?: boolean }).isAdmin = !!token.isAdmin;
      }
      return session;
    },
  },
});
