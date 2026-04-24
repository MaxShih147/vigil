import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <main className="container mx-auto max-w-sm px-6 pt-32">
      <h1 className="text-3xl font-bold mb-2">vigil</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Sign in to access recordings.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <Button type="submit" className="w-full">
          Sign in with Google
        </Button>
      </form>
      <p className="text-xs text-muted-foreground mt-6">
        New here? Sign in with the Google account you want access for. If
        you&apos;re not on the access list yet, you&apos;ll be prompted to
        request access.
      </p>
    </main>
  );
}
