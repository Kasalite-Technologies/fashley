import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Asset } from "@/lib/tailor/contracts";

export type ShareSelection = {
  includeMeasurements: boolean;
  permittedAssetIds: string[];
  actions: Array<"request_changes" | "approve_design" | "verify_measurements" | "accept_brief">;
  expiresInHours: 1 | 6 | 24;
  pin?: string | undefined;
};

export function ShareBriefDialog({
  open,
  onOpenChange,
  briefNumber,
  assets,
  measurementCount,
  reviewUrl,
  busy,
  error,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  briefNumber: number;
  assets: Asset[];
  measurementCount: number;
  reviewUrl: string | null;
  busy?: boolean;
  error?: string | null;
  onCreate: (selection: ShareSelection) => void;
}) {
  const [includeMeasurements, setIncludeMeasurements] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<string[]>(() =>
    assets.filter((a) => a.kind !== "person_source").map((a) => a.id),
  );
  const [allowVerify, setAllowVerify] = useState(false);
  const [allowAccept, setAllowAccept] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState<1 | 6 | 24>(24);
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState("");
  const [consent, setConsent] = useState(false);

  const actions: ShareSelection["actions"] = ["request_changes", "approve_design"];
  if (includeMeasurements && allowVerify) actions.push("verify_measurements");
  if (includeMeasurements && allowAccept) actions.push("accept_brief");

  function toggleAsset(id: string, checked: boolean) {
    setSelectedAssets((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((a) => a !== id),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share brief {briefNumber} for review</DialogTitle>
          <DialogDescription>
            Choose exactly what the reviewer can see and do. A forwarded or downloaded copy cannot
            be recalled.
          </DialogDescription>
        </DialogHeader>

        {reviewUrl ? (
          <div className="space-y-3">
            <Alert>
              <AlertTitle>Review link created</AlertTitle>
              <AlertDescription>
                Copy it now. For security it is kept only while this dialog is open and cannot be
                shown again after you close it or refresh.
              </AlertDescription>
            </Alert>
            <div className="space-y-1.5">
              <Label htmlFor="review-link">Review link</Label>
              <Input id="review-link" readOnly value={reviewUrl} className="min-h-11" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() => {
                  void navigator.clipboard?.writeText(reviewUrl);
                }}
              >
                Copy link
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Please review my tailoring brief ${briefNumber}: ${reviewUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open WhatsApp
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              If you set a PIN, send it separately. Do not add it to the WhatsApp message.
            </p>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              onCreate({
                includeMeasurements,
                permittedAssetIds: selectedAssets,
                actions,
                expiresInHours,
                pin: usePin && pin ? pin : undefined,
              });
            }}
          >
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Images to include</legend>
              {assets.map((asset) => {
                const isPerson = asset.kind === "person_source";
                return (
                  <div key={asset.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`share-asset-${asset.id}`}
                      checked={selectedAssets.includes(asset.id)}
                      onCheckedChange={(v) => toggleAsset(asset.id, v === true)}
                    />
                    <Label htmlFor={`share-asset-${asset.id}`}>
                      {asset.kind.replace(/_/g, " ")}
                      {isPerson ? " (your photo, off by default)" : ""}
                    </Label>
                  </div>
                );
              })}
            </fieldset>

            <div className="flex items-start gap-3">
              <Checkbox
                id="share-measurements"
                checked={includeMeasurements}
                onCheckedChange={(v) => setIncludeMeasurements(v === true)}
              />
              <div>
                <Label htmlFor="share-measurements">Include measurements</Label>
                <p className="text-sm text-muted-foreground">
                  Off by default.{" "}
                  {includeMeasurements
                    ? `${measurementCount} measurement(s) will be included.`
                    : "Measurements will be omitted and labelled as not shared."}
                </p>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Actions the reviewer may take</legend>
              <p className="text-sm text-muted-foreground">
                Request changes and approve design are included.
              </p>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="share-verify"
                  checked={allowVerify}
                  disabled={!includeMeasurements}
                  onCheckedChange={(v) => setAllowVerify(v === true)}
                />
                <div>
                  <Label htmlFor="share-verify">Verify measurements</Label>
                  {!includeMeasurements ? (
                    <p className="text-sm text-muted-foreground">
                      Turn on Include measurements to allow this.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="share-accept"
                  checked={allowAccept}
                  disabled={!includeMeasurements}
                  onCheckedChange={(v) => setAllowAccept(v === true)}
                />
                <div>
                  <Label htmlFor="share-accept">Accept brief</Label>
                  {!includeMeasurements ? (
                    <p className="text-sm text-muted-foreground">
                      Turn on Include measurements to allow this. Acceptance also needs design
                      approval and verified measurements.
                    </p>
                  ) : null}
                </div>
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="share-expiry">Link expires after</Label>
              <select
                id="share-expiry"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value) as 1 | 6 | 24)}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value={1}>1 hour</option>
                <option value={6}>6 hours</option>
                <option value={24}>24 hours</option>
              </select>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="share-pin-toggle"
                checked={usePin}
                onCheckedChange={(v) => setUsePin(v === true)}
              />
              <div className="flex-1">
                <Label htmlFor="share-pin-toggle">Add an optional PIN</Label>
                <p className="text-sm text-muted-foreground">
                  A PIN adds a second possession check. It does not verify who the reviewer is. Send
                  it separately from the link.
                </p>
                {usePin ? (
                  <div className="mt-2 space-y-1.5">
                    <Label htmlFor="share-pin">PIN</Label>
                    <Input
                      id="share-pin"
                      type="password"
                      autoComplete="off"
                      minLength={4}
                      maxLength={64}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="min-h-11"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <section aria-label="Included data preview" className="rounded-md border p-3 text-sm">
              <h3 className="font-semibold">What the reviewer will see</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Brief {briefNumber}, garment and design decisions</li>
                <li>{selectedAssets.length} selected image(s)</li>
                <li>
                  {includeMeasurements
                    ? `${measurementCount} measurement(s)`
                    : "Measurements omitted"}
                </li>
                <li>Actions: {actions.join(", ").replace(/_/g, " ")}</li>
              </ul>
            </section>

            <div className="flex items-start gap-3">
              <Checkbox
                id="share-consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
              />
              <Label htmlFor="share-consent">
                I agree to share the data listed above with whoever holds this link, under the
                current sharing policy.
              </Label>
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="min-h-11"
                disabled={busy || !consent || selectedAssets.length === 0}
              >
                {busy ? "Creating link" : "Create review link"}
              </Button>
            </DialogFooter>
            {!consent ? (
              <p className="text-sm text-muted-foreground">
                Tick the sharing agreement to enable Create review link.
              </p>
            ) : null}
            {selectedAssets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Select at least one image to include.</p>
            ) : null}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
