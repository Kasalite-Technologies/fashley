export type CustomerStatus = {
  label: string;
  hint: string | null;
};

function humanize(value: string): string {
  const text = value.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

const REVIEW_STATUS: Record<string, CustomerStatus> = {
  awaiting_review: {
    label: "Sent to tailor — waiting",
    hint: "Waiting for your tailor to review this brief.",
  },
  changes_requested: {
    label: "Tailor asked for changes",
    hint: "Open to see what to change.",
  },
  design_approved: {
    label: "Tailor approved",
    hint: "Your tailor approved this brief.",
  },
  accepted: {
    label: "Tailor approved",
    hint: "Your tailor approved this brief.",
  },
};

/**
 * Plain-language status for the customer who owns the outfit, derived only
 * from the existing project status and reviewStatus fields. Unknown values
 * are shown as-is (humanised) with no invented next step.
 */
export function customerStatusFor(input: {
  status?: string | null | undefined;
  reviewStatus?: string | null | undefined;
}): CustomerStatus {
  const reviewStatus = input.reviewStatus?.trim() ? input.reviewStatus : null;
  if (reviewStatus) {
    return REVIEW_STATUS[reviewStatus] ?? { label: humanize(reviewStatus), hint: null };
  }
  const status = input.status?.trim() ? input.status : null;
  if (!status) return { label: "No brief yet", hint: null };
  if (status === "active" || status === "draft") {
    return { label: "Draft — not sent yet", hint: "Open to continue your outfit." };
  }
  if (status === "archived") return { label: "Archived", hint: null };
  return { label: humanize(status), hint: null };
}

export type TailorFeedbackAction = {
  action: string;
  reviewerName: string;
  note: string | null;
  createdAt: string;
  identityVerified?: boolean;
};

export type TailorFeedback = {
  label: string;
  reviewerName: string;
  note: string | null;
  createdAt: string;
  identityVerified: boolean;
};

const FEEDBACK_LABEL: Record<string, string> = {
  approve_design: "Your tailor approved the design",
  accept_brief: "Your tailor approved this brief",
  request_changes: "Your tailor asked for changes",
  verify_measurements: "Your tailor verified measurements",
};

/** Latest tailor review action already exposed on the brief detail payload. */
export function latestTailorFeedback(
  actions: readonly TailorFeedbackAction[],
): TailorFeedback | null {
  if (!actions.length) return null;
  const latest = actions.reduce((current, action) =>
    action.createdAt > current.createdAt ? action : current,
  );
  return {
    label: FEEDBACK_LABEL[latest.action] ?? humanize(latest.action),
    reviewerName: latest.reviewerName,
    note: latest.note?.trim() ? latest.note : null,
    createdAt: latest.createdAt,
    identityVerified: latest.identityVerified ?? false,
  };
}
