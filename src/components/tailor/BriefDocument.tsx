import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Brief, RedactedBrief } from "@/lib/tailor/contracts";
import { ProjectStatusBadge } from "./status";

function Omitted({ label }: { label: string }) {
  return (
    <section aria-label={`${label} not shared`}>
      <h3 className="text-lg">{label}</h3>
      <p className="text-sm text-muted-foreground">Not shared by customer</p>
    </section>
  );
}

export function BriefDocument({
  brief,
  redacted,
  assetUrl,
}: {
  brief?: Brief;
  redacted?: RedactedBrief;
  assetUrl: (assetId: string) => string;
}) {
  if (redacted) {
    return (
      <article className="space-y-6" aria-label={`Tailoring brief ${redacted.briefNumber}`}>
        <header className="space-y-2">
          <h2 className="text-2xl">Tailoring brief {redacted.briefNumber}</h2>
          <p className="text-sm text-muted-foreground">
            {redacted.title} · {redacted.template.name} · Finalized{" "}
            {new Date(redacted.finalizedAt).toLocaleString()}
          </p>
          <ProjectStatusBadge status={redacted.reviewStatus} />
        </header>
        <p className="text-sm">{redacted.disclaimer}</p>
        <section aria-label="Shared images">
          <h3 className="text-lg">Shared images</h3>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {redacted.assets.map((asset) => (
              <figure key={asset.id}>
                <img
                  src={assetUrl(asset.id)}
                  alt="Shared garment or fabric image"
                  className="aspect-square w-full rounded-md border object-cover"
                />
                <figcaption className="mt-1 text-sm text-muted-foreground">
                  {asset.kind.replace(/_/g, " ")}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
        <Separator />
        {redacted.measurements ? (
          <section aria-label="Measurements">
            <h3 className="text-lg">Measurements</h3>
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-3">Measurement</th>
                  <th className="py-2 pr-3">Value</th>
                  <th className="py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {redacted.measurements.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="py-2 pr-3">
                      {m.name} ({m.kind})
                    </td>
                    <td className="py-2 pr-3">{m.valueMm ? `${m.valueMm} mm` : "Not supplied"}</td>
                    <td className="py-2">{m.source.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <Omitted label="Measurements" />
        )}
        {redacted.decisions ? (
          <section aria-label="Decisions">
            <h3 className="text-lg">Decisions</h3>
            <ul className="list-disc pl-5 text-sm">
              {redacted.decisions.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </section>
        ) : (
          <Omitted label="Decisions" />
        )}
        {redacted.questions ? (
          <section aria-label="Questions">
            <h3 className="text-lg">Questions</h3>
            <ul className="list-disc pl-5 text-sm">
              {redacted.questions.map((q) => (
                <li key={q.id}>{q.text}</li>
              ))}
            </ul>
          </section>
        ) : (
          <Omitted label="Questions" />
        )}
        {redacted.omittedSections.includes("materials") ? <Omitted label="Materials" /> : null}
        {redacted.omittedSections.includes("assumptions") ? <Omitted label="Assumptions" /> : null}
        {redacted.constraintStatus ? (
          <p className="text-sm">
            Fabric check: <Badge variant="secondary">{redacted.constraintStatus}</Badge>
          </p>
        ) : (
          <Omitted label="Fabric check" />
        )}
      </article>
    );
  }

  if (!brief) return null;
  const content = brief.content;
  return (
    <article className="space-y-6" aria-label={`Tailoring brief ${brief.briefNumber}`}>
      <header className="space-y-2">
        <h2 className="text-2xl">Tailoring brief {brief.briefNumber}</h2>
        <p className="text-sm text-muted-foreground">
          {content.title} · {content.template.name} · Input revision {brief.revisionId} · Created{" "}
          {new Date(brief.createdAt).toLocaleString()}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{brief.state}</Badge>
          <ProjectStatusBadge status={brief.review.status} />
        </div>
      </header>
      <p className="text-sm">{content.disclaimer}</p>
      <p className="text-sm font-medium">
        This is a design illustration. Professional measurement and construction judgment is
        required. It is not a cutting pattern.
      </p>
      <section aria-label="Concept and fabric">
        <h3 className="text-lg">Concept and fabric</h3>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          {brief.assets.map((asset) => (
            <figure key={asset.id}>
              <img
                src={assetUrl(asset.id)}
                alt={
                  asset.kind === "concept"
                    ? "Generated garment concept illustration"
                    : "Confirmed fabric swatch"
                }
                className="aspect-square w-full rounded-md border object-cover"
              />
              <figcaption className="mt-1 text-sm text-muted-foreground">
                {asset.kind.replace(/_/g, " ")}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <Separator />
      <section aria-label="Garment">
        <h3 className="text-lg">Garment</h3>
        <p className="text-sm">
          {content.template.name} · Fit: {content.inputSnapshot.overview.fit}
          {content.inputSnapshot.overview.occasion
            ? ` · Occasion: ${content.inputSnapshot.overview.occasion}`
            : ""}
        </p>
        {content.decisions.length ? (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {content.decisions.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <section aria-label="Fabric">
        <h3 className="text-lg">Fabric</h3>
        <p className="text-sm">
          Usable width:{" "}
          {content.inputSnapshot.fabric.widthMm
            ? `${content.inputSnapshot.fabric.widthMm} mm`
            : "Not supplied"}{" "}
          · Usable length:{" "}
          {content.inputSnapshot.fabric.lengthMm
            ? `${content.inputSnapshot.fabric.lengthMm} mm`
            : "Not supplied"}
        </p>
        <p className="text-sm">
          Fabric check: {content.constraint.status}
          {content.constraint.rule
            ? ` under rule ${content.constraint.rule.ruleVersion}`
            : ". Tailor estimate required."}
        </p>
      </section>
      <section aria-label="Measurements">
        <h3 className="text-lg">Measurements</h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-3">Measurement</th>
              <th className="py-2 pr-3">Value</th>
              <th className="py-2 pr-3">Source</th>
              <th className="py-2">Verification</th>
            </tr>
          </thead>
          <tbody>
            {content.measurements.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="py-2 pr-3">
                  {m.name} ({m.kind})
                </td>
                <td className="py-2 pr-3">{m.valueMm ? `${m.valueMm} mm` : "Not supplied"}</td>
                <td className="py-2 pr-3">{m.source.replace(/_/g, " ")}</td>
                <td className="py-2">
                  {m.verification.status === "verified"
                    ? `Verified by ${m.verification.actorName ?? "reviewer"}`
                    : "Not verified"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-muted-foreground">
          Verified {brief.review.verifiedMeasurementCount} of{" "}
          {brief.review.requiredMeasurementCount} required measurements.
        </p>
      </section>
      <section aria-label="Materials">
        <h3 className="text-lg">Materials</h3>
        <ul className="list-disc pl-5 text-sm">
          {content.materials.map((m) => (
            <li key={m.label}>
              {m.label}: {m.quantity ?? "Quantity not known"} (source: {m.source})
            </li>
          ))}
        </ul>
      </section>
      {content.assumptions.length ? (
        <section aria-label="Assumptions">
          <h3 className="text-lg">Assumptions</h3>
          <ul className="list-disc pl-5 text-sm">
            {content.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {content.questions.length ? (
        <section aria-label="Questions">
          <h3 className="text-lg">Questions</h3>
          <ul className="list-disc pl-5 text-sm">
            {content.questions.map((q) => (
              <li key={q.id}>
                {q.text}
                {q.required && !q.resolved ? " (still to resolve)" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {brief.review.actions.length ? (
        <section aria-label="Review history">
          <h3 className="text-lg">Review actions</h3>
          <ul className="space-y-1 text-sm">
            {brief.review.actions.map((a) => (
              <li key={a.id}>
                {a.action.replace(/_/g, " ")} by {a.reviewerName} (
                {a.identityVerified ? "verified identity" : "name as stated, not verified"}) on{" "}
                {new Date(a.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
