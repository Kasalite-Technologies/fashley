import { z } from "zod";
import {
  dateOnlySchema,
  enteredMeasurementUnitSchema,
  enteredValueSchema,
  idSchema,
} from "./common";

export const fitSchema = z.enum(["regular", "relaxed", "fitted"]);
export const yesNoUnknownSchema = z.enum(["yes", "no", "unknown"]);
export const shrinkageSchema = z.enum(["preshrunk", "not_preshrunk", "unknown"]);

export const fabricSelectionSchema = z
  .object({
    method: z.enum(["sam", "manual_crop"]),
    sourceAssetId: idSchema,
    cropAssetId: idSchema,
    maskAssetId: idSchema.nullable(),
    regionId: z.string().max(128).nullable(),
    analysisJobId: idSchema.nullable(),
  })
  .strict();

export const confirmedObservationSchema = z
  .object({
    key: z.string().min(1).max(100),
    value: z.string().min(1).max(500),
    origin: z.enum(["user", "spark"]),
  })
  .strict();

export const measurementInputSchema = z
  .object({
    name: z.string().min(1).max(100),
    kind: z.enum(["body", "garment"]),
    valueMm: z.number().int().positive().nullable(),
    enteredValue: z.string().max(32).nullable(),
    enteredUnit: enteredMeasurementUnitSchema,
    source: z.enum(["customer_manual", "tailor_manual", "experimental_photo_estimate"]),
    sourceAssetId: idSchema.nullable(),
    recordedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();
export type MeasurementInput = z.infer<typeof measurementInputSchema>;

export const projectInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    overview: z
      .object({
        title: z.string().min(1).max(100),
        occasion: z.string().max(200).nullable(),
        deadline: dateOnlySchema.nullable(),
        timezone: z.string().min(1).max(100),
        fit: fitSchema,
        notes: z.string().max(2000),
      })
      .strict(),
    template: z
      .object({ id: idSchema, version: z.number().int().min(1) })
      .strict()
      .nullable(),
    fabric: z
      .object({
        sourceAssetId: idSchema.nullable(),
        selection: fabricSelectionSchema.nullable(),
        widthMm: z.number().int().positive().nullable(),
        lengthMm: z.number().int().positive().nullable(),
        enteredWidth: enteredValueSchema.nullable(),
        enteredLength: enteredValueSchema.nullable(),
        directionality: yesNoUnknownSchema,
        stretch: yesNoUnknownSchema,
        shrinkage: shrinkageSchema,
        confirmedObservations: z.array(confirmedObservationSchema).max(50),
      })
      .strict(),
    design: z
      .object({
        optionIds: z.record(z.string().max(100), z.string().max(100)),
        personAssetId: idSchema.nullable(),
      })
      .strict(),
    measurements: z.array(measurementInputSchema).max(50),
    selectedConceptAssetId: idSchema.nullable(),
    customerQuestions: z.array(z.string().min(1).max(500)).max(10),
  })
  .strict();
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const emptyProjectInput = (title: string, timezone: string): ProjectInput => ({
  schemaVersion: 1,
  overview: { title, occasion: null, deadline: null, timezone, fit: "regular", notes: "" },
  template: null,
  fabric: {
    sourceAssetId: null,
    selection: null,
    widthMm: null,
    lengthMm: null,
    enteredWidth: null,
    enteredLength: null,
    directionality: "unknown",
    stretch: "unknown",
    shrinkage: "unknown",
    confirmedObservations: [],
  },
  design: { optionIds: {}, personAssetId: null },
  measurements: [],
  selectedConceptAssetId: null,
  customerQuestions: [],
});
