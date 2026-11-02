import { createFileRoute } from "@tanstack/react-router";
import { CustomAuth, AUTH_REDIRECTS, type AuthRedirect } from "@/components/CustomAuth";

type SignInSearch = { redirectTo: AuthRedirect; mode: "in" | "up" };

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    redirectTo: (AUTH_REDIRECTS as readonly string[]).includes(String(search["redirectTo"]))
      ? (search["redirectTo"] as AuthRedirect)
      : "/studio",
    mode: search["mode"] === "up" ? "up" : "in",
  }),
  head: () => ({
    meta: [
      { title: "Sign in | Fashley" },
      { name: "description", content: "Sign in to open your Fashley design studio." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { redirectTo, mode } = Route.useSearch();
  return <CustomAuth redirectTo={redirectTo} initialMode={mode} />;
}
