export type MeasurementDisplayUnit = "cm" | "in";
export type MeasurementEnteredUnit = "mm" | "cm" | "in";

const MM_PER_UNIT: Record<MeasurementEnteredUnit, number> = { mm: 1, cm: 10, in: 25.4 };

export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatMeasurementNumber(value: number): string {
  const rounded = roundToOneDecimal(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Convert a raw entered string between units. Blank stays blank; invalid input is returned unchanged so the user can correct it. */
export function convertMeasurementValue(
  raw: string,
  from: MeasurementEnteredUnit,
  to: MeasurementEnteredUnit,
): string {
  if (raw.trim() === "") return "";
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return raw;
  if (from === to) return raw;
  const mm = parsed * MM_PER_UNIT[from];
  return formatMeasurementNumber(mm / MM_PER_UNIT[to]);
}

export function measurementValueMm(raw: string, unit: MeasurementEnteredUnit): number | null {
  if (raw.trim() === "") return null;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed * MM_PER_UNIT[unit]);
}

export function measurementInputError(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === "") return null;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return "Enter a number, for example 92.";
  if (parsed <= 0) return "Enter a measurement above zero.";
  return null;
}

export type MeasurementLike = { name: string; valueMm: number | null };
export type MeasurementFieldLike = { name: string; required: boolean };

export function countFilledMeasurements(
  measurements: readonly MeasurementLike[],
  fields?: readonly MeasurementFieldLike[] | null,
): number {
  if (fields) {
    return fields.filter((f) =>
      measurements.some((m) => m.name === f.name && m.valueMm !== null),
    ).length;
  }
  return measurements.filter((m) => m.valueMm !== null).length;
}

export function isMeasurementsComplete(
  measurements: readonly MeasurementLike[],
  fields?: readonly MeasurementFieldLike[] | null,
): boolean {
  if (!fields) return measurements.some((m) => m.valueMm !== null);
  const required = fields.filter((f) => f.required);
  // If a template declares no required fields, completeness follows filled count.
  const targets = required.length ? required : fields;
  return targets.every((f) =>
    measurements.some((m) => m.name === f.name && m.valueMm !== null),
  );
}
