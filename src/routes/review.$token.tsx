import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TailorApiError, tailorApi, tailorKeys } from "@/lib/tailor/client";

export const Route = createFileRoute("/review/$token")({
  head: () => ({
    meta: [
      { title: "Open a private tailoring brief | Fashley" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ReviewEntryPage,
});

export function ReviewEntryPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [failed, setFailed] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);

  const exchange = useMutation({
    mutationFn: () => tailorApi.reviewExchange({ token, pin: pin ? pin : undefined }),
    onSuccess: () => {
      // The token leaves the URL before any private content is fetched.
      queryClient.removeQueries({ queryKey: tailorKeys.reviewSession() });
      void navigate({ to: "/review", replace: true });
    },
    onError: (e) => {
      setRateLimited(e instanceof TailorApiError && e.code === "RATE_LIMITED");
      setFailed(true);
    },
  });

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <p className="text-sm font-semibold">Fashley</p>
      <h1 className="mt-4 text-3xl">Open a private tailoring brief</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This link was shared with you by a customer. Opening it does not create an account, and it
        does not prove your identity to the customer. Do not forward the link.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        If another brief is already open in this browser, opening this one will replace it.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setFailed(false);
          exchange.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="review-pin">PIN (only if the customer gave you one)</Label>
          <Input
            id="review-pin"
            type="password"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="min-h-11"
          />
        </div>
        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            {rateLimited
              ? "Too many attempts. Wait a few minutes, then try again."
              : "This review link could not be opened. It may have expired or been revoked. Ask the customer for a current link."}
          </p>
        ) : null}
        <Button type="submit" className="min-h-11 w-full" disabled={exchange.isPending}>
          {exchange.isPending ? "Opening brief" : "Open secure brief"}
        </Button>
      </form>
    </main>
  );
}
