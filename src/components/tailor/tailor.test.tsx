import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fixtureBrief,
  fixtureRedactedBriefNoMeasurements,
  type ReviewSessionResponse,
} from "@/lib/tailor/contracts";
import { BriefDocument } from "./BriefDocument";
import { customerStatusFor, latestTailorFeedback } from "./customerStatus";
import { MeasurementField, ConstraintCard } from "./fields";
import { ProjectStepper } from "./ProjectStepper";
import { ReviewActionPanel } from "./ReviewActionPanel";
import { ShareBriefDialog } from "./ShareBriefDialog";
import { CustomerProjectStatus } from "./status";
import { TailorAppShell } from "./TailorAppShell";

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

describe("customerStatusFor (fixture evidence)", () => {
  it("maps each known review status to customer words with one next step", () => {
    expect(customerStatusFor({ status: "active", reviewStatus: null })).toEqual({
      label: "Draft — not sent yet",
      hint: "Open to continue your outfit.",
    });
    expect(customerStatusFor({ status: "active", reviewStatus: "awaiting_review" })).toEqual({
      label: "Sent to tailor — waiting",
      hint: "Waiting for your tailor to review this brief.",
    });
    expect(customerStatusFor({ status: "active", reviewStatus: "changes_requested" })).toEqual({
      label: "Tailor asked for changes",
      hint: "Open to see what to change.",
    });
    expect(customerStatusFor({ status: "active", reviewStatus: "design_approved" })).toEqual({
      label: "Tailor approved",
      hint: "Your tailor approved this brief.",
    });
    expect(customerStatusFor({ status: "active", reviewStatus: "accepted" })).toEqual({
      label: "Tailor approved",
      hint: "Your tailor approved this brief.",
    });
  });

  it("shows unknown values honestly with no invented hint", () => {
    expect(customerStatusFor({ status: "active", reviewStatus: "some_future_state" })).toEqual({
      label: "Some future state",
      hint: null,
    });
    expect(customerStatusFor({ status: "archived", reviewStatus: null })).toEqual({
      label: "Archived",
      hint: null,
    });
    expect(customerStatusFor({ status: null, reviewStatus: null })).toEqual({
      label: "No brief yet",
      hint: null,
    });
  });

  it("renders the customer badge and hint", () => {
    render(<CustomerProjectStatus status="active" reviewStatus="changes_requested" />);
    expect(screen.getByText("Tailor asked for changes")).toBeInTheDocument();
    expect(screen.getByText("Open to see what to change.")).toBeInTheDocument();
  });
});

describe("latestTailorFeedback (fixture evidence)", () => {
  it("returns the newest review action with its note", () => {
    const feedback = latestTailorFeedback([
      {
        action: "approve_design",
        reviewerName: "Fixture Tailor",
        note: null,
        createdAt: "2026-10-30T10:00:00.000Z",
      },
      {
        action: "request_changes",
        reviewerName: "Fixture Tailor",
        note: "Please lengthen the sleeve.",
        createdAt: "2026-10-31T10:00:00.000Z",
      },
    ]);
    expect(feedback).toMatchObject({
      label: "Your tailor asked for changes",
      note: "Please lengthen the sleeve.",
      reviewerName: "Fixture Tailor",
    });
    expect(latestTailorFeedback([])).toBeNull();
  });
});

describe("TailorAppShell customer branding", () => {
  it("renders the customer brand and nav labels", async () => {
    const { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } =
      await import("@tanstack/react-router");
    const rootRoute = createRootRoute({
      component: () => (
        <TailorAppShell title="My outfit projects">
          <p>Dashboard child</p>
        </TailorAppShell>
      ),
    });
    const stub = (path: string) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: () => null,
      });
    const routeTree = rootRoute.addChildren([
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/",
        component: () => null,
      }),
      stub("/tailor"),
      stub("/tailor/new"),
      stub("/account"),
    ]);
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText("Fashley — my outfits")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /My outfit projects/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Start a new outfit/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Account/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "My outfits" })).toBeInTheDocument();
    expect(screen.queryByText("Fashley Tailor")).not.toBeInTheDocument();
  });
});

describe("ConstraintCard", () => {
  it("states unknown plainly instead of implying success", () => {
    render(<ConstraintCard constraint={fixtureBrief.content.constraint} />);
    expect(screen.getByText(/Fabric requirement is unknown/)).toBeInTheDocument();
    expect(screen.getByText(/Tailor estimate required/)).toBeInTheDocument();
  });
});
