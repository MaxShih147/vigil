import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VIGIL // edge.recorder",
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
    <html lang="en" className={`${jetbrains.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-scanlines">
        {session && (
          <nav className="border-b border-phosphor/30 sticky top-0 z-30 bg-background/90 backdrop-blur-sm">
            <div className="container mx-auto max-w-6xl px-6 py-3 flex items-center justify-between text-xs">
              <Link href="/" className="flex items-baseline gap-3 group">
                <span className="text-phosphor inline-block w-1.5 h-1.5 animate-tally translate-y-[-3px]" />
                <span className="font-mono font-bold tracking-[0.18em] text-sm glow">
                  VIGIL
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-phosphor-dim hidden sm:inline">
                  // edge.recorder · v0
                </span>
              </Link>
              <div className="flex items-center gap-5 font-mono uppercase tracking-[0.18em] text-[11px]">
                <Link
                  href="/devices"
                  className="text-phosphor-dim hover:text-phosphor transition-colors"
                >
                  ./devices
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="text-phosphor-dim hover:text-phosphor transition-colors"
                  >
                    ./admin
                  </Link>
                )}
                <span className="text-phosphor-dim/70 hidden md:inline normal-case tracking-normal">
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
                    className="text-phosphor-dim hover:text-warn transition-colors uppercase tracking-[0.18em]"
                  >
                    [logout]
                  </button>
                </form>
              </div>
            </div>
          </nav>
        )}
        <div className="flex-1">{children}</div>
        <footer className="border-t border-phosphor/20 mt-12">
          <div className="container mx-auto max-w-6xl px-6 py-4 flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.25em] text-phosphor-dim/60">
            <span>vigil_sys @ 2026 // online</span>
            <span className="hidden sm:inline">// the signal is being watched //</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
