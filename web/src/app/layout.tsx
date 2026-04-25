import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VIGIL · edge recording dashboard",
  description: "vigil — distributed webcam recording, watched.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)
    ?.isAdmin;

  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${jetbrains.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-scanlines">
        {session && (
          <nav className="border-b border-border/60 sticky top-0 z-30 bg-background/85 backdrop-blur-md">
            <div className="container mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
              <Link href="/" className="flex items-baseline gap-3 group">
                <span className="text-amber inline-block w-1.5 h-1.5 rounded-full animate-tally translate-y-[-3px]" />
                <span className="font-bricolage font-semibold tracking-[0.18em] text-base">
                  VIGIL
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground hidden sm:inline">
                  edge recorder · v0
                </span>
              </Link>
              <div className="flex items-center gap-5 text-xs font-mono uppercase tracking-[0.18em]">
                <Link
                  href="/devices"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Devices
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <span className="text-muted-foreground/60 hidden md:inline normal-case tracking-normal">
                  {session.user?.email}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/signin" });
                  }}
                >
                  <button
                    type="submit"
                    className="text-muted-foreground hover:text-warn transition-colors uppercase tracking-[0.18em]"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </nav>
        )}
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border/40 mt-12">
          <div className="container mx-auto max-w-6xl px-6 py-4 flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground/60">
            <span>VIGIL · 2026</span>
            <span className="hidden sm:inline">SECURE · OFFLINE-TOLERANT · OBSERVED</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
