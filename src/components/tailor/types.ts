export type ReviewStatus = "awaiting_review" | "changes_requested" | "design_approved" | "accepted";

export const WORKSPACE_STEPS = [
  { id: "overview", label: "Overview" },
  { id: "fabric", label: "Fabric" },
  { id: "design", label: "Design" },
  { id: "measurements", label: "Measurements" },
  { id: "brief", label: "Brief" },
  { id: "handoff", label: "Handoff" },
] as const;

export type WorkspaceStep = (typeof WORKSPACE_STEPS)[number]["id"];

export function normalizeStep(value: unknown): WorkspaceStep {
  return WORKSPACE_STEPS.some((s) => s.id === value) ? (value as WorkspaceStep) : "overview";
}
