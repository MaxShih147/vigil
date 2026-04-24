import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vigil",
  description: "vigil — edge recording dashboard",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {session && (
          <nav className="border-b bg-background">
            <div className="container mx-auto max-w-5xl px-6 py-3 flex items-center justify-between">
              <Link href="/" className="font-bold text-lg">
                vigil
              </Link>
              <div className="flex items-center gap-4 text-sm">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Admin
                  </Link>
                )}
                <span className="text-muted-foreground hidden sm:inline">
                  {session.user?.email}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/signin" });
                  }}
                >
                  <Button type="submit" size="sm" variant="outline">
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          </nav>
        )}
        {children}
      </body>
    </html>
  );
}
