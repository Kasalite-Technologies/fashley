import type { Db } from "./db";
import { notFound } from "./errors";

export interface TemplateRow {
  id: string;
  version: number;
  status: string;
  name: string;
  garment_kind: string;
  description: string;
  measurement_schema_json: string;
  design_options_json: string;
  rule_json: string | null;
  reviewer_name: string | null;
  reviewed_at: number | null;
}
/** A reviewed rule is explicit versioned data on a published template row. Never invented here. */
export interface ReviewedRule {
  requiredLengthMm: number;
  ruleVersion: string;
  requiredMeasurements?: string[];
}

export async function listPublishedTemplates(db: Db, limit = 20) {
  const { results } = await db
    .prepare(
      "SELECT * FROM garment_templates WHERE status = ? ORDER BY id ASC, version DESC LIMIT ?",
    )
    .bind("published", limit)
    .all<TemplateRow>();
  const seen = new Set<string>();
  return results.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))).map(toSummary);
}
export const toSummary = (r: TemplateRow) => ({
  id: r.id,
  version: r.version,
  name: r.name,
  garmentKind: r.garment_kind,
  description: r.description,
});

export async function getPublishedTemplate(
  db: Db,
  id: string,
  version?: number,
): Promise<TemplateRow> {
  const row = version
    ? await db
        .prepare("SELECT * FROM garment_templates WHERE id = ? AND version = ? AND status = ?")
        .bind(id, version, "published")
        .first<TemplateRow>()
    : await db
        .prepare(
          "SELECT * FROM garment_templates WHERE id = ? AND status = ? ORDER BY version DESC LIMIT 1",
        )
        .bind(id, "published")
        .first<TemplateRow>();
  if (!row) throw notFound();
  return row;
}
export function templateDetail(r: TemplateRow) {
  return {
    ...toSummary(r),
    measurementFields: JSON.parse(r.measurement_schema_json),
    designOptions: JSON.parse(r.design_options_json),
    hasReviewedRule: Boolean(r.rule_json && r.reviewer_name && r.reviewed_at),
  };
}
export function reviewedRule(r: TemplateRow | null): ReviewedRule | null {
  if (!r || r.status !== "published" || !r.rule_json || !r.reviewer_name || !r.reviewed_at)
    return null;
  try {
    const parsed = JSON.parse(r.rule_json) as Partial<ReviewedRule>;
    if (
      typeof parsed.requiredLengthMm !== "number" ||
      parsed.requiredLengthMm <= 0 ||
      !parsed.ruleVersion
    )
      return null;
    return {
      requiredLengthMm: parsed.requiredLengthMm,
      ruleVersion: parsed.ruleVersion,
      ...(parsed.requiredMeasurements ? { requiredMeasurements: parsed.requiredMeasurements } : {}),
    };
  } catch {
    return null;
  }
}
