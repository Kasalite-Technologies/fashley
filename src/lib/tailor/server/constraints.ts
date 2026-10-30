import type { Blocker, ConstraintResult, ProjectInput } from "../contracts";
import type { ReviewedRule } from "./templates";

export interface ChecksResult {
  constraint: ConstraintResult;
  missingMeasurements: string[];
  unverifiedMeasurements: string[];
  blockers: Blocker[];
}

/** Deterministic checks only. No reviewed rule / no dimensions => unknown. Never invents anthropometric ranges. */
export function evaluateConstraints(
  input: ProjectInput,
  opts: {
    rule: ReviewedRule | null;
    templateId?: string | null;
    templateVersion?: number | null;
    requiredMeasurements?: string[];
  },
): ChecksResult {
  const required = opts.requiredMeasurements ?? opts.rule?.requiredMeasurements ?? [];
  const missingMeasurements = required.filter((name) => {
    const m = input.measurements.find((x) => x.name === name);
    return !m || m.valueMm === null;
  });
  const unverifiedMeasurements = input.measurements
    .filter((m) => m.valueMm !== null)
    .map((m) => m.name);
  const blockers: Blocker[] = [];
  if (missingMeasurements.length)
    blockers.push({
      code: "MISSING_MEASUREMENTS",
      message: `Missing required measurements: ${missingMeasurements.join(", ")}.`,
      blocks: ["accept"],
    });

  const available = input.fabric.lengthMm;
  let constraint: ConstraintResult;
  if (!opts.rule || !opts.templateId) {
    constraint = {
      status: "unknown",
      rule: null,
      availableLengthMm: available,
      requiredLengthMm: null,
      assumptions: [],
      reasons: [
        {
          code: "NO_REVIEWED_RULE",
          message:
            "Tailor estimate required: no tailor-reviewed rule is available for this template.",
        },
      ],
    };
  } else if (available === null) {
    constraint = {
      status: "unknown",
      rule: {
        templateId: opts.templateId,
        version: opts.templateVersion ?? 1,
        ruleVersion: opts.rule.ruleVersion,
      },
      availableLengthMm: null,
      requiredLengthMm: opts.rule.requiredLengthMm,
      assumptions: [],
      reasons: [
        {
          code: "MISSING_FABRIC_DIMENSIONS",
          message: "Fabric length has not been entered.",
          fieldPath: "fabric.lengthMm",
        },
      ],
    };
  } else if (available >= opts.rule.requiredLengthMm) {
    constraint = {
      status: "sufficient",
      rule: {
        templateId: opts.templateId,
        version: opts.templateVersion ?? 1,
        ruleVersion: opts.rule.ruleVersion,
      },
      availableLengthMm: available,
      requiredLengthMm: opts.rule.requiredLengthMm,
      assumptions: [],
      reasons: [
        {
          code: "LENGTH_SUFFICIENT",
          message: "Available length meets the reviewed rule requirement.",
        },
      ],
    };
  } else {
    constraint = {
      status: "insufficient",
      rule: {
        templateId: opts.templateId,
        version: opts.templateVersion ?? 1,
        ruleVersion: opts.rule.ruleVersion,
      },
      availableLengthMm: available,
      requiredLengthMm: opts.rule.requiredLengthMm,
      assumptions: [],
      reasons: [
        {
          code: "LENGTH_SHORT",
          message: "Available length is below the reviewed rule requirement.",
          fieldPath: "fabric.lengthMm",
        },
      ],
    };
  }
  if (constraint.status === "unknown")
    blockers.push({
      code: "FABRIC_UNKNOWN",
      message: "Fabric requirement is unknown. Tailor estimate required.",
      blocks: ["accept"],
    });
  if (constraint.status === "insufficient")
    blockers.push({
      code: "FABRIC_INSUFFICIENT",
      message: "Not enough fabric for the reviewed rule.",
      blocks: ["accept"],
    });
  return { constraint, missingMeasurements, unverifiedMeasurements, blockers };
}
