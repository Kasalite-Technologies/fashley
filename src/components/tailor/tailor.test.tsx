import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fixtureBrief,
  fixtureRedactedBriefNoMeasurements,
  type ReviewSessionResponse,
} from "@/lib/tailor/contracts";
import { BriefDocument } from "./BriefDocument";
import { MeasurementField, ConstraintCard } from "./fields";
import { ProjectStepper } from "./ProjectStepper";
import { ReviewActionPanel } from "./ReviewActionPanel";
import { ShareBriefDialog } from "./ShareBriefDialog";

afterEach(() => cleanup());

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

const sessionNoMeasurements: ReviewSessionResponse = {
  grant: {
    id: "grt_fixture_1",
    expiresAt: "2026-10-31T10:00:00.000Z",
    actions: ["request_changes", "approve_design"],
    includeMeasurements: false,
  },
  brief: fixtureRedactedBriefNoMeasurements,
  capabilities: { canApprove: true, canVerify: false, canAccept: false, blockingReasons: [] },
  reviewerIdentity: { method: "possession_link", verified: false },
};

// These tests render synthetic fixture data only (fixture evidence).
describe("ShareBriefDialog defaults (fixture evidence)", () => {
  it("keeps measurements and person image off by default", () => {
    render(
      <ShareBriefDialog
        open
        briefNumber={1}
        measurementCount={1}
        reviewUrl={null}
        assets={[
          {
            id: "ast_concept",
            projectId: "prj_1",
            kind: "concept",
            mime: "image/png",
            bytes: 10,
            widthPx: 10,
            heightPx: 10,
            parentAssetId: null,
            createdAt: "2026-10-30T10:00:00.000Z",
          },
          {
            id: "ast_person",
            projectId: "prj_1",
            kind: "person_source",
            mime: "image/jpeg",
            bytes: 10,
            widthPx: 10,
            heightPx: 10,
            parentAssetId: null,
            createdAt: "2026-10-30T10:00:00.000Z",
          },
        ]}
        onOpenChange={() => {}}
        onCreate={() => {}}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /Include measurements/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /person source/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Verify measurements/ })).toBeDisabled();
    expect(screen.getByText(/Measurements will be omitted/)).toBeInTheDocument();
  });
});

describe("BriefDocument redaction (fixture evidence)", () => {
  it("omits measurement values for a RedactedBrief without measurements", () => {
    const { container } = render(
      <BriefDocument
        redacted={fixtureRedactedBriefNoMeasurements}
        assetUrl={(id) => `/review-assets/${id}`}
      />,
    );
    expect(screen.getAllByText("Not shared by customer").length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("920");
    expect(container.textContent).not.toContain("msr_fixture_bust");
  });

  it("shows measurement values on the owner brief", () => {
    render(<BriefDocument brief={fixtureBrief} assetUrl={(id) => `/assets/${id}`} />);
    expect(screen.getByText(/920 mm/)).toBeInTheDocument();
    expect(screen.getByText("Not verified")).toBeInTheDocument();
  });
});

describe("ReviewActionPanel gating (fixture evidence)", () => {
  it("disables verify and accept when measurements were not shared", () => {
    render(
      <ReviewActionPanel session={sessionNoMeasurements} measurements={null} onAction={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Verify measurements" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Accept brief" })).toBeDisabled();
    expect(
      screen.getAllByText(/Measurements were not shared by the customer/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/has not verified your identity/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve design" })).toBeEnabled();
  });
});

describe("ProjectStepper accessibility", () => {
  it("marks the current step with aria-current", () => {
    const onStep = vi.fn();
    render(
      <ProjectStepper current="measurements" completed={["overview", "fabric"]} onStep={onStep} />,
    );
    const current = screen.getByRole("button", { name: /Step 4: Measurements, current step/ });
    expect(current).toHaveAttribute("aria-current", "step");
    fireEvent.click(screen.getByRole("button", { name: /Step 2: Fabric, completed/ }));
    expect(onStep).toHaveBeenCalledWith("fabric");
  });
});

describe("MeasurementField error linking", () => {
  it("links the error text with aria-describedby and marks the input invalid", () => {
    render(
      <MeasurementField
        name="bust"
        label="Bust"
        kind="body"
        required
        unit="cm"
        guidance="Measure around the fullest part."
        value="abc"
        source="customer_manual"
        error="Enter a number, for example 92."
        onChange={() => {}}
      />,
    );
    const input = screen.getByLabelText(/Bust \(cm\)/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("error");
    expect(
      document.getElementById(describedBy.split(" ").find((id) => id.includes("error")) ?? ""),
    ).toHaveTextContent("Enter a number");
    expect(screen.getByText("Not verified")).toBeInTheDocument();
  });
});

describe("ConstraintCard", () => {
  it("states unknown plainly instead of implying success", () => {
    render(<ConstraintCard constraint={fixtureBrief.content.constraint} />);
    expect(screen.getByText(/Fabric requirement is unknown/)).toBeInTheDocument();
    expect(screen.getByText(/Tailor estimate required/)).toBeInTheDocument();
  });
});
