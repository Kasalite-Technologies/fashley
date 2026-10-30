import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MeasurementView, ReviewSessionResponse } from "@/lib/tailor/contracts";

export type ReviewActionSubmission = {
  action: "request_changes" | "approve_design" | "verify_measurements" | "accept_brief";
  reviewerName: string;
  note?: string | undefined;
  verifications?:
    | Array<{
        measurementId: string;
        valueMm: number;
        method: "in_person_tape" | "reviewed_record";
      }>
    | undefined;
};

export function ReviewActionPanel({
  session,
  measurements,
  busy,
  receipt,
  onAction,
}: {
  session: ReviewSessionResponse;
  measurements: MeasurementView[] | null;
  busy?: boolean;
  receipt?: string | null;
  onAction: (submission: ReviewActionSubmission) => void;
}) {
  const [name, setName] = useState("");
  const [openAction, setOpenAction] = useState<ReviewActionSubmission["action"] | null>(null);
  const [note, setNote] = useState("");
  const [confirmedVersion, setConfirmedVersion] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [method, setMethod] = useState<"in_person_tape" | "reviewed_record">("in_person_tape");
  const [formError, setFormError] = useState<string | null>(null);

  const allowed = session.grant.actions;
  const canVerify =
    session.capabilities.canVerify &&
    allowed.includes("verify_measurements") &&
    measurements !== null;
  const canAccept = session.capabilities.canAccept && allowed.includes("accept_brief");
  const canApprove = session.capabilities.canApprove && allowed.includes("approve_design");
  const blockingText = session.capabilities.blockingReasons.map((b) => b.message).join(" ");

  function submit(action: ReviewActionSubmission["action"]) {
    if (!name.trim()) {
      setFormError("Enter your name as the reviewer.");
      return;
    }
    if (!confirmedVersion) {
      setFormError(`Confirm you are acting on brief ${session.brief.briefNumber} as shown.`);
      return;
    }
    if (action === "request_changes" && !note.trim()) {
      setFormError("Describe the change you are requesting.");
      return;
    }
    if (action === "verify_measurements" && checked.length === 0) {
      setFormError("Select at least one measurement you checked.");
      return;
    }
    setFormError(null);
    onAction({
      action,
      reviewerName: name.trim(),
      note: note.trim() ? note.trim() : undefined,
      verifications:
        action === "verify_measurements"
          ? measurements
              ?.filter((m) => checked.includes(m.id) && m.valueMm)
              .map((m) => ({ measurementId: m.id, valueMm: m.valueMm as number, method }))
          : undefined,
    });
  }

  function section(
    action: ReviewActionSubmission["action"],
    title: string,
    enabled: boolean,
    disabledReason: string,
    body: React.ReactNode,
  ) {
    return (
      <section className="space-y-3 border-t pt-4" aria-label={title}>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <Button
            type="button"
            className="min-h-11"
            disabled={!enabled || busy}
            aria-expanded={openAction === action}
            onClick={() => setOpenAction(openAction === action ? null : action)}
          >
            {title}
          </Button>
        </div>
        {!enabled ? <p className="text-sm text-muted-foreground">{disabledReason}</p> : null}
        {openAction === action && enabled ? body : null}
      </section>
    );
  }

  const confirmBlock = (
    <div className="flex items-start gap-3">
      <Checkbox
        id={`confirm-${openAction}`}
        checked={confirmedVersion}
        onCheckedChange={(v) => setConfirmedVersion(v === true)}
      />
      <Label htmlFor={`confirm-${openAction}`}>
        I confirm this action applies to brief {session.brief.briefNumber} exactly as shown on this
        page.
      </Label>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Review actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          This link grants access. The sender has not verified your identity, and a PIN does not
          change that. Your name below is recorded as stated by you, not as a verified identity.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="reviewer-name">Your name (as stated by you)</Label>
          <Input
            id="reviewer-name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11"
            autoComplete="name"
          />
        </div>
        {receipt ? (
          <Alert role="status">
            <AlertTitle>Action recorded</AlertTitle>
            <AlertDescription>{receipt}</AlertDescription>
          </Alert>
        ) : null}
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        {section(
          "request_changes",
          "Request changes",
          allowed.includes("request_changes"),
          "The customer did not allow change requests on this link.",
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="changes-note">What should change</Label>
              <Textarea
                id="changes-note"
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-24"
              />
            </div>
            {confirmBlock}
            <Button
              type="button"
              className="min-h-11"
              disabled={busy}
              onClick={() => submit("request_changes")}
            >
              Submit change request
            </Button>
          </div>,
        )}

        {section(
          "approve_design",
          "Approve design",
          canApprove,
          blockingText || "Design approval is not available for this brief right now.",
          <div className="space-y-3">
            <p className="text-sm">Approving the design does not verify any measurements.</p>
            <div className="space-y-1.5">
              <Label htmlFor="approve-note">Note (optional)</Label>
              <Textarea
                id="approve-note"
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {confirmBlock}
            <Button
              type="button"
              className="min-h-11"
              disabled={busy}
              onClick={() => submit("approve_design")}
            >
              Approve this design
            </Button>
          </div>,
        )}

        {section(
          "verify_measurements",
          "Verify measurements",
          canVerify,
          measurements === null
            ? "Measurements were not shared by the customer, so they cannot be verified here."
            : blockingText || "Measurement verification is not available for this link.",
          <div className="space-y-3">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Measurements you checked</legend>
              {measurements?.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`verify-${m.id}`}
                    checked={checked.includes(m.id)}
                    disabled={m.source === "experimental_photo_estimate" || !m.valueMm}
                    onCheckedChange={(v) =>
                      setChecked((prev) =>
                        v === true ? [...prev, m.id] : prev.filter((id) => id !== m.id),
                      )
                    }
                  />
                  <Label htmlFor={`verify-${m.id}`}>
                    {m.name}: {m.valueMm ? `${m.valueMm} mm` : "Not supplied"} (source:{" "}
                    {m.source.replace(/_/g, " ")})
                    {m.source === "experimental_photo_estimate"
                      ? " Experimental estimates cannot be verified. Ask for a manual measurement."
                      : ""}
                  </Label>
                </div>
              ))}
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="verify-method">How did you check them</Label>
              <select
                id="verify-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="in_person_tape">Measured in person with a tape</option>
                <option value="reviewed_record">Checked against a written record</option>
              </select>
            </div>
            {confirmBlock}
            <Button
              type="button"
              className="min-h-11"
              disabled={busy}
              onClick={() => submit("verify_measurements")}
            >
              Verify selected measurements
            </Button>
          </div>,
        )}

        {section(
          "accept_brief",
          "Accept brief",
          canAccept,
          measurements === null
            ? "Measurements were not shared by the customer, so this brief cannot be accepted here."
            : blockingText ||
                "Acceptance is not available until design approval, verified measurements, fabric sufficiency and required questions are complete.",
          <div className="space-y-3">
            <p className="text-sm">
              Accepting means this brief can be used to prepare production. This is not a
              machine-ready cutting pattern.
            </p>
            {confirmBlock}
            <Button
              type="button"
              className="min-h-11"
              disabled={busy}
              onClick={() => submit("accept_brief")}
            >
              Accept this brief
            </Button>
          </div>,
        )}
      </CardContent>
    </Card>
  );
}
