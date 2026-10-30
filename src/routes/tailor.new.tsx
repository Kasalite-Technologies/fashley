import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { TailorAppShell } from "@/components/tailor/TailorAppShell";
import { EmptyState, PageError } from "@/components/tailor/status";
import { IdempotencyKeyKeeper, tailorApi, tailorKeys } from "@/lib/tailor/client";

export const Route = createFileRoute("/tailor/new")({
  head: () => ({
    meta: [{ title: "New tailoring project | Fashley" }, { name: "robots", content: "noindex" }],
  }),
  component: NewProjectPage,
});

export function NewProjectPage() {
  const navigate = useNavigate();
  const keeper = useRef(new IdempotencyKeyKeeper());
  const [title, setTitle] = useState("");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [occasion, setOccasion] = useState("");
  const [fit, setFit] = useState<"regular" | "relaxed" | "fitted">("regular");
  const [deadline, setDeadline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: tailorKeys.templates(),
    queryFn: () => tailorApi.listTemplates({ limit: 50 }),
    retry: false,
  });
  const me = useQuery({ queryKey: tailorKeys.me(), queryFn: () => tailorApi.me(), retry: false });

  const create = useMutation({
    mutationFn: () => {
      const [id, version] = templateKey.split("@");
      return tailorApi.createProject(
        {
          title: title.trim(),
          template: { id, version: Number(version) },
          occasion: occasion.trim() || null,
          deadline: deadline || null,
          fit,
          timezone:
            me.data?.preferences.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        keeper.current.keyFor("create-project"),
      );
    },
    onSuccess: (detail) => {
      keeper.current.clear("create-project");
      void navigate({
        to: "/tailor/projects/$projectId",
        params: { projectId: detail.project.id },
        search: { step: "fabric" },
      });
    },
  });

  return (
    <TailorAppShell title="New project">
      <form
        className="max-w-2xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) {
            setFormError("Enter a project title.");
            return;
          }
          if (!templateKey) {
            setFormError("Choose a garment template.");
            return;
          }
          setFormError(null);
          create.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="project-title">Project title</Label>
          <Input
            id="project-title"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-11"
            placeholder="For example, Blue ankara dress"
            aria-describedby="project-title-help"
          />
          <p id="project-title-help" className="text-sm text-muted-foreground">
            Use a name you and your tailor will recognise.
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Garment</legend>
          {templates.isPending ? (
            <Skeleton className="h-24" />
          ) : templates.isError ? (
            <PageError error={templates.error} onRetry={() => void templates.refetch()} />
          ) : templates.data.items.length === 0 ? (
            <EmptyState
              title="No templates are published yet"
              description="Project creation is unavailable until a reviewed garment template is published. You can return to your projects."
              action={
                <Button asChild variant="outline" className="min-h-11">
                  <Link to="/tailor">Back to projects</Link>
                </Button>
              }
            />
          ) : (
            <RadioGroup
              value={templateKey}
              onValueChange={setTemplateKey}
              aria-label="Garment template"
            >
              {templates.data.items.map((t) => {
                const key = `${t.id}@${t.version}`;
                return (
                  <div key={key} className="flex items-start gap-3 rounded-md border p-4">
                    <RadioGroupItem value={key} id={`template-${key}`} className="mt-1" />
                    <Label htmlFor={`template-${key}`} className="space-y-1">
                      <span className="block font-medium">{t.name}</span>
                      <span className="block text-sm font-normal text-muted-foreground">
                        {t.description || t.garmentKind}
                      </span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="project-occasion">Occasion (optional)</Label>
          <Input
            id="project-occasion"
            value={occasion}
            maxLength={200}
            onChange={(e) => setOccasion(e.target.value)}
            className="min-h-11"
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Fit</legend>
          <RadioGroup value={fit} onValueChange={(v) => setFit(v as typeof fit)} aria-label="Fit">
            {(["regular", "relaxed", "fitted"] as const).map((option) => (
              <div key={option} className="flex items-center gap-3">
                <RadioGroupItem value={option} id={`fit-${option}`} />
                <Label htmlFor={`fit-${option}`} className="capitalize">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="project-deadline">Needed by (optional)</Label>
          <Input
            id="project-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="min-h-11"
          />
          {deadline && deadline < new Date().toISOString().slice(0, 10) ? (
            <p className="text-sm text-muted-foreground">
              This date is in the past. You can still save it, but check it is what you meant.
            </p>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          Concepts are illustrations. Your tailor must confirm fit and construction.
        </p>
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        {create.isError ? <PageError error={create.error} onRetry={() => create.mutate()} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/tailor">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="min-h-11"
            disabled={create.isPending || templates.data?.items.length === 0}
          >
            {create.isPending ? "Creating project" : "Create project"}
          </Button>
        </div>
      </form>
    </TailorAppShell>
  );
}
