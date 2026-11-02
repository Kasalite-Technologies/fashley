import { createFileRoute } from "@tanstack/react-router";
import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/sso-callback")({
  head: () => ({
    meta: [{ title: "Signing you in | Fashley" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <main className="mx-auto max-w-md px-5 py-16" role="status">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/studio"
        signUpFallbackRedirectUrl="/studio"
      />
    </main>
  ),
});
