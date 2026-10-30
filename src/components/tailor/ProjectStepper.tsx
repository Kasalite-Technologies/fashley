import { CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";
import { WORKSPACE_STEPS, type WorkspaceStep } from "./types";

export function ProjectStepper({
  current,
  completed = [],
  attention = [],
  onStep,
}: {
  current: WorkspaceStep;
  completed?: WorkspaceStep[];
  attention?: WorkspaceStep[];
  onStep?: (step: WorkspaceStep) => void;
}) {
  return (
    <nav aria-label="Project steps">
      <ol className="flex flex-wrap gap-2">
        {WORKSPACE_STEPS.map((step, index) => {
          const isCurrent = step.id === current;
          const isDone = completed.includes(step.id);
          const needsAttention = attention.includes(step.id);
          const Icon = needsAttention ? TriangleAlert : isDone ? CheckCircle2 : CircleDashed;
          const stateLabel = needsAttention
            ? "needs attention"
            : isDone
              ? "completed"
              : isCurrent
                ? "current step"
                : "not completed";
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${step.label}, ${stateLabel}`}
                onClick={() => onStep?.(step.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isCurrent ? "border-foreground bg-secondary font-semibold" : "border-border bg-background"}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span aria-hidden="true">{index + 1}. </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
