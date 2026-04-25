import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-sm">
          {/* Top mark */}
          <div className="flex items-baseline gap-3 mb-12 justify-center">
            <span className="text-phosphor inline-block w-2 h-2 animate-tally translate-y-[-4px]" />
            <span className="font-mono font-bold tracking-[0.22em] text-sm glow">
              VIGIL_SYS
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor-dim">
              // tty.0
            </span>
          </div>

          {/* Hero */}
          <div className="mb-10 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor-dim mb-3">
              [ authorized_access_only ]
            </div>
            <h1 className="font-mono text-3xl font-bold tracking-[-0.025em] leading-tight mb-3 uppercase glow">
              ACCESS<span className="animate-cursor"></span>
            </h1>
            <p className="font-mono text-xs text-phosphor-dim mt-4">
              &gt; auth via google. allowlist enforced.
            </p>
          </div>

          {/* CTA */}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
            className="space-y-4"
          >
            <button
              type="submit"
              className="group w-full flex items-center justify-center gap-3 bg-phosphor text-background font-mono uppercase tracking-[0.2em] text-xs py-4 px-6 hover:bg-background hover:text-phosphor border border-phosphor transition-colors font-bold"
            >
              <GoogleMark />
              <span>&gt; auth_with_google</span>
            </button>

            <p className="text-[11px] font-mono text-phosphor-dim text-center leading-relaxed pt-4 border-t border-phosphor/20">
              &gt; new here? sign in with the google account you want access for.
              if you&apos;re not on the allowlist, you&apos;ll be guided to
              request it.
            </p>
          </form>
        </div>
      </div>

      <div className="border-t border-phosphor/20 overflow-hidden">
        <div className="container mx-auto max-w-6xl px-6 py-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-phosphor-dim/60">
          <span>vigil_sys @ 2026</span>
          <span className="hidden sm:inline">// request -- review -- record //</span>
        </div>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg
      viewBox="0 0 18 18"
      className="w-3.5 h-3.5"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="currentColor"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        opacity="0.85"
      />
      <path
        fill="currentColor"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        opacity="0.6"
      />
      <path
        fill="currentColor"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        opacity="0.7"
      />
    </svg>
  );
}
