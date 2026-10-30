import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TailorAppShell } from "@/components/tailor/TailorAppShell";
import { PageError } from "@/components/tailor/status";
import { IdempotencyKeyKeeper, tailorApi, tailorKeys } from "@/lib/tailor/client";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account | Fashley" }, { name: "robots", content: "noindex" }] }),
  component: AccountPage,
});

export function AccountPage() {
  const keeper = useRef(new IdempotencyKeyKeeper());
  const me = useQuery({ queryKey: tailorKeys.me(), queryFn: () => tailorApi.me(), retry: false });
  const userId = me.data?.user.id ?? "current";
  const consents = useQuery({
    queryKey: tailorKeys.consents(userId),
    queryFn: () => tailorApi.listConsents(),
    enabled: Boolean(me.data),
    retry: false,
  });
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [timezone, setTimezone] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) {
      setUnit(me.data.preferences.measurementUnit);
      setTimezone(me.data.preferences.timezone);
    }
  }, [me.data]);

  const savePreferences = useMutation({
    mutationFn: () =>
      tailorApi.updatePreferences({
        expectedVersion: me.data?.preferences.version,
        measurementUnit: unit,
        timezone,
      }),
    onSuccess: () => {
      setSavedNote("Preferences saved.");
      void me.refetch();
    },
  });

  const withdraw = useMutation({
    mutationFn: (consentId: string) =>
      tailorApi.withdrawConsent(consentId, keeper.current.keyFor(`withdraw-${consentId}`)),
    onSuccess: (_d, consentId) => {
      keeper.current.clear(`withdraw-${consentId}`);
      void consents.refetch();
    },
  });

  return (
    <TailorAppShell title="Account">
      {me.isPending ? (
        <Skeleton className="h-64" />
      ) : me.isError ? (
        <PageError error={me.error} onRetry={() => void me.refetch()} />
      ) : me.data ? (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{me.data.user.displayName || "Fashley customer"}</p>
              <p className="text-muted-foreground">{me.data.user.email}</p>
              <p className="text-muted-foreground">
                Sign-in and security are handled when you sign in. There is no separate password to
                manage on this page.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSavedNote(null);
                  savePreferences.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="pref-unit">Measurement unit</Label>
                  <select
                    id="pref-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as "cm" | "in")}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="cm">Centimetres (cm)</option>
                    <option value="in">Inches (in)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    This changes how measurements are shown. Saved measurement values are not
                    rewritten.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pref-timezone">Timezone</Label>
                  <input
                    id="pref-timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                {savePreferences.isError ? <PageError error={savePreferences.error} /> : null}
                {savedNote ? (
                  <p role="status" className="text-sm">
                    {savedNote}
                  </p>
                ) : null}
                <Button type="submit" className="min-h-11" disabled={savePreferences.isPending}>
                  {savePreferences.isPending ? "Saving" : "Save preferences"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Privacy and consents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Withdrawing a consent stops new processing for that purpose and revokes review links
                that depend on it. Copies someone already downloaded cannot be recalled.
              </p>
              {consents.isPending ? (
                <Skeleton className="h-24" />
              ) : consents.isError ? (
                <PageError error={consents.error} onRetry={() => void consents.refetch()} />
              ) : consents.data.items.length === 0 ? (
                <p className="text-sm">
                  You have not granted any processing or sharing consents yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {consents.data.items.map((consent) => (
                    <li
                      key={consent.id}
                      className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm"
                    >
                      <span>
                        {consent.purpose.replace(/_/g, " ")} · Policy {consent.policyVersion} ·
                        Granted {new Date(consent.grantedAt).toLocaleDateString()} ·{" "}
                        {consent.withdrawnAt
                          ? `Withdrawn ${new Date(consent.withdrawnAt).toLocaleDateString()}`
                          : "Active"}
                      </span>
                      {!consent.withdrawnAt ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={withdraw.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Withdraw this consent? New processing for this purpose will stop and related review links will be revoked.",
                              )
                            )
                              withdraw.mutate(consent.id);
                          }}
                        >
                          Withdraw
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                Pilot credits: {me.data.credits.available} available, {me.data.credits.reserved}{" "}
                reserved.
              </p>
              <p className="mt-2 text-muted-foreground">
                This pilot has no payments or top-ups. Person photos, when enabled, are kept for{" "}
                {me.data.policy.personRetentionDays} days under policy {me.data.policy.version}.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </TailorAppShell>
  );
}
