import { savedCategory, type DesignKind } from "./design-options";

export type DesignPreferences = {
  kind: DesignKind;
  category: string;
  occasion: string;
  style: string;
  hardware: string;
  notes: string;
};

export type DesignResult = {
  src: string;
  final: boolean;
  preferences: DesignPreferences;
  error?: string;
};

export function designMetadata(preferences: DesignPreferences) {
  return {
    category: savedCategory(preferences.kind, preferences.category),
    occasion: preferences.occasion,
    style: preferences.kind === "outfits" ? preferences.style : `${preferences.style} · ${preferences.hardware} hardware`,
  };
}