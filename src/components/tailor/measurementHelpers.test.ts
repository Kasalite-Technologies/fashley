import { describe, expect, it } from "vitest";
import {
  convertMeasurementValue,
  countFilledMeasurements,
  isMeasurementsComplete,
  measurementInputError,
  measurementValueMm,
} from "./measurementHelpers";

describe("convertMeasurementValue", () => {
  it("converts cm to in", () => {
    expect(convertMeasurementValue("92", "cm", "in")).toBe("36.2");
    expect(convertMeasurementValue("10", "cm", "in")).toBe("3.9");
  });
  it("converts in to cm", () => {
    expect(convertMeasurementValue("36.2", "in", "cm")).toBe("91.9");
    expect(convertMeasurementValue("10", "in", "cm")).toBe("25.4");
  });
  it("keeps blank blank and invalid unchanged", () => {
    expect(convertMeasurementValue("", "cm", "in")).toBe("");
    expect(convertMeasurementValue("abc", "cm", "in")).toBe("abc");
  });
  it("is identity for same unit", () => {
    expect(convertMeasurementValue("92", "cm", "cm")).toBe("92");
  });
});

describe("measurementValueMm / error", () => {
  it("converts to mm and rejects invalid/zero/negative", () => {
    expect(measurementValueMm("92", "cm")).toBe(920);
    expect(measurementValueMm("10", "in")).toBe(254);
    expect(measurementValueMm("abc", "cm")).toBeNull();
    expect(measurementValueMm("0", "cm")).toBeNull();
    expect(measurementValueMm("-5", "cm")).toBeNull();
    expect(measurementValueMm("", "cm")).toBeNull();
  });
  it("produces inline errors", () => {
    expect(measurementInputError("abc")).toBe("Enter a number, for example 92.");
    expect(measurementInputError("0")).toBe("Enter a measurement above zero.");
    expect(measurementInputError("-1")).toBe("Enter a measurement above zero.");
    expect(measurementInputError("92")).toBeNull();
    expect(measurementInputError("")).toBeNull();
    expect(measurementInputError(null)).toBeNull();
  });
});

describe("filled count / completeness", () => {
  const fields = [
    { name: "bust", required: true },
    { name: "waist", required: true },
    { name: "hip", required: false },
  ];
  it("counts only filled template fields", () => {
    expect(countFilledMeasurements([{ name: "bust", valueMm: 920 }], fields)).toBe(1);
    expect(
      countFilledMeasurements(
        [
          { name: "bust", valueMm: 920 },
          { name: "other", valueMm: 100 },
        ],
        fields,
      ),
    ).toBe(1);
  });
  it("requires all required fields", () => {
    expect(isMeasurementsComplete([{ name: "bust", valueMm: 920 }], fields)).toBe(false);
    expect(
      isMeasurementsComplete(
        [
          { name: "bust", valueMm: 920 },
          { name: "waist", valueMm: 800 },
        ],
        fields,
      ),
    ).toBe(true);
  });
  it("falls back to any-value when template unavailable", () => {
    expect(isMeasurementsComplete([], null)).toBe(false);
    expect(isMeasurementsComplete([{ name: "bust", valueMm: 920 }], null)).toBe(true);
    expect(isMeasurementsComplete([{ name: "bust", valueMm: null }], undefined)).toBe(false);
  });
});
