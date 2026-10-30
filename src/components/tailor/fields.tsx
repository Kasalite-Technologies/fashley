import { useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { ConstraintResult } from "@/lib/tailor/contracts";

export function FabricUploadField({
  onFile,
  disabled,
  disabledReason,
  status,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  disabledReason?: string;
  status?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <Label htmlFor="fabric-file">Fabric photo</Label>
        <p id="fabric-file-help" className="text-sm text-muted-foreground">
          JPEG, PNG or WebP, up to 10 MiB. Lay the fabric flat in clear light. A photo cannot
          establish how much fabric you have.
        </p>
        <input
          ref={inputRef}
          id="fabric-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-describedby="fabric-file-help"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 10_485_760) {
              setError("This file is larger than 10 MiB. Choose a smaller photo.");
              return;
            }
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
              setError("Choose a JPEG, PNG or WebP photo.");
              return;
            }
            setError(null);
            setFileName(file.name);
            onFile(file);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="min-h-11"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden="true" /> Choose photo
          </Button>
          {fileName ? <span className="text-sm">{fileName}</span> : null}
          {status ? (
            <span role="status" className="text-sm text-muted-foreground">
              {status}
            </span>
          ) : null}
        </div>
        {disabled && disabledReason ? (
          <p className="text-sm text-muted-foreground">{disabledReason}</p>
        ) : null}
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Photo not accepted</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function UploadProgress({ value }: { value: number | null }) {
  if (value === null) return null;
  return <Progress value={value} aria-label="Upload progress" />;
}

export function MeasurementField({
  name,
  label,
  kind,
  required,
  unit,
  guidance,
  value,
  source,
  verificationStatus,
  error,
  onChange,
  onSourceChange,
}: {
  name: string;
  label: string;
  kind: "body" | "garment";
  required?: boolean;
  unit: string;
  guidance?: string;
  value: string;
  source: string;
  verificationStatus?: "unverified" | "verified";
  error?: string | null;
  onChange: (value: string) => void;
  onSourceChange?: (source: string) => void;
}) {
  const autoId = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const inputId = `measurement-${name}-${autoId}`;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  const describedBy =
    [guidance ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={inputId}>
          {label} ({unit}){required ? <span aria-hidden="true"> *</span> : null}
        </Label>
        <Badge variant="outline">
          {kind === "body" ? "Body measurement" : "Garment measurement"}
        </Badge>
        <Badge variant="secondary">
          {verificationStatus === "verified" ? "Verified by reviewer" : "Not verified"}
        </Badge>
      </div>
      {guidance ? (
        <p id={helpId} className="text-sm text-muted-foreground">
          {guidance}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          id={inputId}
          name={name}
          inputMode="decimal"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 max-w-48"
          placeholder="Leave blank if not measured"
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
        <Label htmlFor={`${inputId}-source`} className="sr-only">
          Source for {label}
        </Label>
        <select
          id={`${inputId}-source`}
          value={source}
          onChange={(e) => onSourceChange?.(e.target.value)}
          className="min-h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="customer_manual">Entered by customer</option>
          <option value="tailor_manual">Entered by tailor</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        Source: {source === "tailor_manual" ? "Tailor manual entry" : "Customer manual entry"}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ConstraintCard({ constraint }: { constraint: ConstraintResult }) {
  const heading =
    constraint.status === "sufficient"
      ? "Fabric looks sufficient under the reviewed rule"
      : constraint.status === "insufficient"
        ? "Fabric is insufficient under the reviewed rule"
        : "Fabric requirement is unknown";
  return (
    <Card>
      <CardContent className="space-y-3 py-5" aria-live="polite">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg">{heading}</h3>
          <Badge variant={constraint.status === "sufficient" ? "default" : "secondary"}>
            {constraint.status}
          </Badge>
        </div>
        {constraint.status === "unknown" ? (
          <p className="text-sm">
            Tailor estimate required. This result does not confirm there is enough fabric.
          </p>
        ) : null}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Available length</dt>
            <dd>
              {constraint.availableLengthMm ? `${constraint.availableLengthMm} mm` : "Not known"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Required length</dt>
            <dd>
              {constraint.requiredLengthMm ? `${constraint.requiredLengthMm} mm` : "Not known"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reviewed rule</dt>
            <dd>
              {constraint.rule
                ? `${constraint.rule.templateId} rule ${constraint.rule.ruleVersion}`
                : "No reviewed rule"}
            </dd>
          </div>
        </dl>
        {constraint.assumptions.length ? (
          <div>
            <h4 className="text-sm font-semibold">Assumptions</h4>
            <ul className="list-disc pl-5 text-sm">
              {constraint.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {constraint.reasons.length ? (
          <ul className="space-y-1 text-sm">
            {constraint.reasons.map((r) => (
              <li key={r.code}>{r.message}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
