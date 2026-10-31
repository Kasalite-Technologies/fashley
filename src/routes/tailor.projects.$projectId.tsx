import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FabricSelectionCanvas } from "@/components/tailor/FabricSelectionCanvas";
import { TailorAppShell } from "@/components/tailor/TailorAppShell";
import { ProjectStepper } from "@/components/tailor/ProjectStepper";
import { DraftSaveStatus, PageError } from "@/components/tailor/status";
import { ConstraintCard, FabricUploadField, MeasurementField } from "@/components/tailor/fields";
import { ConceptViewer, JobStatusPanel } from "@/components/tailor/panels";
import { normalizeStep, type WorkspaceStep } from "@/components/tailor/types";
import {
  IdempotencyKeyKeeper,
  TailorApiError,
  isFixtureMode,
  tailorApi,
  tailorKeys,
} from "@/lib/tailor/client";
import type { Job, ProjectInput } from "@/lib/tailor/contracts";
import { checksResponseSchema } from "@/lib/tailor/contracts";
import type { z } from "zod";

export const Route = createFileRoute("/tailor/projects/$projectId")({
  validateSearch: (search: Record<string, unknown>): { step: WorkspaceStep } => ({
    step: normalizeStep(search["step"]),
  }),
  head: () => ({
    meta: [{ title: "Tailoring project | Fashley" }, { name: "robots", content: "noindex" }],
  }),
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const { projectId } = Route.useParams();
  if (pathname !== `/tailor/projects/${projectId}`) return <Outlet />;
  return <WorkspacePage />;
}

type Checks = z.infer<typeof checksResponseSchema>;

export function WorkspacePage() {
  const { projectId } = Route.useParams();
  const { step } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const keeper = useRef(new IdempotencyKeyKeeper());

  const me = useQuery({ queryKey: tailorKeys.me(), queryFn: () => tailorApi.me(), retry: false });
  const userId = me.data?.user.id ?? "current";
  const project = useQuery({
    queryKey: tailorKeys.project(userId, projectId),
    queryFn: () => tailorApi.getProject(projectId),
    retry: false,
  });

  const [input, setInput] = useState<ProjectInput | null>(null);
  const [draftVersion, setDraftVersion] = useState(1);
  const [projectVersion, setProjectVersion] = useState(1);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "unsaved" | "conflict" | "error"
  >("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [fabricConsent, setFabricConsent] = useState(false);
  const [fabricStatus, setFabricStatus] = useState<string | null>(null);
  const [fabricSelectionPending, setFabricSelectionPending] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [briefJobId, setBriefJobId] = useState<string | null>(null);
  const [compiledBriefId, setCompiledBriefId] = useState<string | null>(null);

  useEffect(() => {
    if (project.data && input === null) {
      setInput(project.data.draft.input);
      setDraftVersion(project.data.draft.version);
      setProjectVersion(project.data.project.version);
      if (project.data.latestJob) setActiveJobId(project.data.latestJob.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.data]);

  const templateId = input?.template?.id;
  const template = useQuery({
    queryKey: tailorKeys.template(templateId ?? "none", input?.template?.version),
    queryFn: () => tailorApi.getTemplate(templateId as string, input?.template?.version),
    enabled: Boolean(templateId),
    retry: false,
  });

  const job = useQuery({
    queryKey: tailorKeys.job(userId, activeJobId ?? "none"),
    queryFn: () => tailorApi.getJob(activeJobId as string),
    enabled: Boolean(activeJobId),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as Job | undefined;
      if (!data || ["completed", "failed", "cancelled"].includes(data.state)) return false;
      return document.hidden ? 10000 : 2000;
    },
  });

  function update(next: ProjectInput) {
    setInput(next);
    setSaveState("unsaved");
  }

  async function saveDraft(
    current: ProjectInput,
  ): Promise<{ draftVersion: number; projectVersion: number }> {
    setSaveState("saving");
    try {
      const saved = await tailorApi.patchDraft(projectId, {
        expectedDraftVersion: draftVersion,
        input: current,
      });
      setDraftVersion(saved.draftVersion);
      setProjectVersion(saved.projectVersion);
      setSavedAt(saved.savedAt);
      setSaveState("saved");
      return saved;
    } catch (e) {
      setSaveState(
        e instanceof TailorApiError && e.code === "REVISION_CONFLICT" ? "conflict" : "error",
      );
      throw e;
    }
  }

  async function saveThenFreeze(current: ProjectInput) {
    const saved = await saveDraft(current);
    const frozen = await tailorApi.createRevision(
      projectId,
      { expectedDraftVersion: saved.draftVersion, expectedProjectVersion: saved.projectVersion },
      keeper.current.keyFor("freeze"),
    );
    keeper.current.clear("freeze");
    setProjectVersion(frozen.projectVersion);
    return frozen.revision;
  }

  const saveMutation = useMutation({
    mutationFn: () => saveDraft(input as ProjectInput),
    onError: (e) => setActionError(e),
  });

  async function runSequence(action: "concept" | "checks" | "brief") {
    if (!input) return;
    setActionError(null);
    try {
      const revision = await saveThenFreeze(input);
      if (action === "concept") {
        const started = await tailorApi.startJob(
          projectId,
          { type: "generate_concept", revisionId: revision.id },
          keeper.current.keyFor("generate-concept"),
        );
        keeper.current.clear("generate-concept");
        setActiveJobId(started.job.id);
      } else if (action === "checks") {
        setChecks(await tailorApi.runChecks(projectId, { revisionId: revision.id }));
      } else {
        const started = await tailorApi.createBrief(
          projectId,
          { revisionId: revision.id },
          keeper.current.keyFor("compile-brief"),
        );
        keeper.current.clear("compile-brief");
        setBriefJobId(started.job.id);
        if (started.job.result?.type === "assemble_brief")
          setCompiledBriefId(started.job.result.briefId);
      }
    } catch (e) {
      setActionError(e);
    }
  }

  const briefJob = useQuery({
    queryKey: tailorKeys.job(userId, briefJobId ?? "none"),
    queryFn: () => tailorApi.getJob(briefJobId as string),
    enabled: Boolean(briefJobId),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as Job | undefined;
      if (!data || ["completed", "failed", "cancelled"].includes(data.state)) return false;
      return 2000;
    },
  });
  useEffect(() => {
    if (briefJob.data?.result?.type === "assemble_brief")
      setCompiledBriefId(briefJob.data.result.briefId);
  }, [briefJob.data]);

  const compiledBrief = useQuery({
    queryKey: tailorKeys.brief(userId, compiledBriefId ?? "none"),
    queryFn: () => tailorApi.getBrief(compiledBriefId as string),
    enabled: Boolean(compiledBriefId),
    retry: false,
  });

  const finalize = useMutation({
    mutationFn: async () => {
      if (!compiledBrief.data) throw new Error("Brief not ready");
      return tailorApi.finalizeBrief(
        compiledBrief.data.id,
        {
          expectedProjectVersion: projectVersion,
          expectedContentHash: compiledBrief.data.contentHash,
          acknowledgedBlockerCodes: compiledBrief.data.blockers.map((b) => b.code),
        },
        keeper.current.keyFor("finalize-brief"),
      );
    },
    onSuccess: () => {
      keeper.current.clear("finalize-brief");
      void navigate({
        to: "/tailor/projects/$projectId/brief",
        params: { projectId },
        search: { step: "overview" },
      });
    },
    onError: (e) => setActionError(e),
  });

  async function handleFabricFile(file: File) {
    if (!input || !me.data) return;
    setActionError(null);
    setFabricStatus("Uploading photo");
    try {
      const consent = await tailorApi.createConsent(
        { purpose: "ai_fabric", policyVersion: me.data.policy.version, projectId },
        keeper.current.keyFor("fabric-consent"),
      );
      keeper.current.clear("fabric-consent");
      const intent = await tailorApi.createUploadIntent(
        projectId,
        { kind: "fabric_source", mime: file.type, bytes: file.size, consentId: consent.id },
        keeper.current.keyFor("fabric-upload"),
      );
      keeper.current.clear("fabric-upload");
      await tailorApi.uploadContent(intent.putUrl, file);
      setFabricStatus("Checking image");
      const status = await tailorApi.completeUpload(
        projectId,
        intent.uploadId,
        keeper.current.keyFor("fabric-complete"),
      );
      keeper.current.clear("fabric-complete");
      if (status.status !== "ready" || !status.asset) {
        setFabricStatus(
          status.error?.message ?? "Image is still being checked. Refresh to see its status.",
        );
        return;
      }
      setFabricStatus("Photo ready");
      update({ ...input, fabric: { ...input.fabric, sourceAssetId: status.asset.id } });
    } catch (e) {
      setFabricStatus(null);
      setActionError(e);
    }
  }

  if (project.isPending || !input) {
    return (
      <TailorAppShell title="Project">
        <Skeleton className="h-64" />
      </TailorAppShell>
    );
  }
  if (project.isError) {
    return (
      <TailorAppShell title="Project">
        <PageError error={project.error} onRetry={() => void project.refetch()} />
      </TailorAppShell>
    );
  }

  const completed: WorkspaceStep[] = [];
  if (input.fabric.selection) completed.push("fabric");
  if (input.selectedConceptAssetId) completed.push("design");
  if (input.measurements.some((m) => m.valueMm)) completed.push("measurements");
  const conceptResult = job.data?.result?.type === "generate_concept" ? job.data.result : null;
  const fabricAnalysis =
    job.data?.state === "completed" &&
    job.data.result?.type === "analyze_fabric" &&
    job.data.result.segmentation.status === "completed" &&
    job.data.result.sourceAssetId === input.fabric.sourceAssetId
      ? { analysisJobId: job.data.id, regions: job.data.result.segmentation.regions }
      : null;
  const fabricSelectionState = input.fabric.selection
    ? input.fabric.selection.method === "sam"
      ? ({ method: "sam", regionId: input.fabric.selection.regionId } as const)
      : ({ method: "manual_crop" } as const)
    : null;
  const frozenLabels = conceptResult
    ? Object.entries(conceptResult.inputSnapshot.design.optionIds).map(([group, choice]) => {
        const groupDef = template.data?.designOptions.find((o) => o.id === group);
        const choiceDef = groupDef?.choices.find((c) => c.id === choice);
        return choiceDef ? `${groupDef?.label}: ${choiceDef.label}` : `${group}: ${choice}`;
      })
    : (template.data?.designOptions ?? []).flatMap((o) => {
        const chosen = input.design.optionIds[o.id];
        const choiceDef = o.choices.find((c) => c.id === chosen);
        return choiceDef ? [`${o.label}: ${choiceDef.label}`] : [];
      });

  return (
    <TailorAppShell title={input.overview.title} projectTitle={input.overview.title}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <DraftSaveStatus state={saveState} savedAt={savedAt} />
          <span className="text-sm text-muted-foreground">
            Input revision: {project.data.currentRevision?.number ?? "not frozen yet"}
          </span>
          <Button asChild variant="outline" className="min-h-11">
            <Link
              to="/tailor/projects/$projectId/history"
              params={{ projectId }}
              search={{ step: "overview" }}
            >
              History
            </Link>
          </Button>
          {project.data.project.latestBriefId ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link
                to="/tailor/projects/$projectId/brief"
                params={{ projectId }}
                search={{ step: "overview" }}
              >
                View current brief
              </Link>
            </Button>
          ) : null}
        </div>

        <ProjectStepper
          current={step}
          completed={completed}
          onStep={(s) =>
            void navigate({
              to: "/tailor/projects/$projectId",
              params: { projectId },
              search: { step: s },
            })
          }
        />

        {saveState === "conflict" ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>This project changed elsewhere</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                Your current edits are still on this screen so you can copy them. Reload to get the
                latest saved draft. Reloading will replace what is shown here, so copy anything you
                need first.
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setInput(null);
                  void queryClient.invalidateQueries({
                    queryKey: tailorKeys.project(userId, projectId),
                  });
                  void project.refetch();
                }}
              >
                Reload latest draft
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {actionError ? <PageError error={actionError} /> : null}
        {isFixtureMode ? (
          <p className="text-xs text-muted-foreground">Fixture mode: synthetic test data only.</p>
        ) : null}

        {step === "overview" ? (
          <section className="max-w-2xl space-y-5" aria-label="Overview">
            <div className="space-y-1.5">
              <Label htmlFor="ov-title">Project title</Label>
              <Input
                id="ov-title"
                value={input.overview.title}
                maxLength={100}
                className="min-h-11"
                onChange={(e) =>
                  update({ ...input, overview: { ...input.overview, title: e.target.value } })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-occasion">Occasion</Label>
              <Input
                id="ov-occasion"
                value={input.overview.occasion ?? ""}
                maxLength={200}
                className="min-h-11"
                onChange={(e) =>
                  update({
                    ...input,
                    overview: { ...input.overview, occasion: e.target.value || null },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-deadline">Needed by</Label>
              <Input
                id="ov-deadline"
                type="date"
                value={input.overview.deadline ?? ""}
                className="min-h-11"
                onChange={(e) =>
                  update({
                    ...input,
                    overview: { ...input.overview, deadline: e.target.value || null },
                  })
                }
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Fit</legend>
              <RadioGroup
                value={input.overview.fit}
                onValueChange={(v) =>
                  update({
                    ...input,
                    overview: { ...input.overview, fit: v as ProjectInput["overview"]["fit"] },
                  })
                }
              >
                {(["regular", "relaxed", "fitted"] as const).map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <RadioGroupItem value={f} id={`ov-fit-${f}`} />
                    <Label htmlFor={`ov-fit-${f}`} className="capitalize">
                      {f}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="ov-notes">Notes for your tailor</Label>
              <Textarea
                id="ov-notes"
                value={input.overview.notes}
                maxLength={2000}
                onChange={(e) =>
                  update({ ...input, overview: { ...input.overview, notes: e.target.value } })
                }
                aria-describedby="ov-notes-count"
              />
              <p id="ov-notes-count" className="text-xs text-muted-foreground">
                {input.overview.notes.length} of 2000 characters
              </p>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Fabric added: {input.fabric.sourceAssetId ? "yes" : "not yet"}</li>
              <li>Fabric region confirmed: {input.fabric.selection ? "yes" : "not yet"}</li>
              <li>Concept selected: {input.selectedConceptAssetId ? "yes" : "not yet"}</li>
              <li>Measurements entered: {input.measurements.filter((m) => m.valueMm).length}</li>
            </ul>
          </section>
        ) : null}

        {step === "fabric" ? (
          <section className="max-w-2xl space-y-5" aria-label="Fabric">
            <Alert>
              <AlertTitle>Photographing your fabric</AlertTitle>
              <AlertDescription>
                Lay it flat in clear light with enough pattern detail. A photo cannot establish how
                much fabric you have, so you will enter the physical size below.
              </AlertDescription>
            </Alert>
            <div className="flex items-start gap-3">
              <Checkbox
                id="fabric-consent"
                checked={fabricConsent}
                onCheckedChange={(v) => setFabricConsent(v === true)}
              />
              <Label htmlFor="fabric-consent">
                I agree that this fabric photo can be processed to find fabric regions, under the
                current policy{me.data ? ` (${me.data.policy.version})` : ""}.
              </Label>
            </div>
            <FabricUploadField
              disabled={!fabricConsent}
              disabledReason="Tick the processing agreement above to enable photo upload."
              status={fabricStatus}
              onFile={(f) => void handleFabricFile(f)}
            />
            {input.fabric.sourceAssetId ? (
              <FabricSelectionCanvas
                sourceAssetId={input.fabric.sourceAssetId}
                imageSrc={tailorApi.ownerAssetUrl(input.fabric.sourceAssetId)}
                analysis={fabricAnalysis}
                selection={fabricSelectionState}
                disabled={fabricSelectionPending}
                manualCropDisabled={!me.data?.capabilities.manualCrop}
                onSelect={async (request) => {
                  setActionError(null);
                  setFabricSelectionPending(true);
                  try {
                    const result = await tailorApi.fabricSelection(
                      projectId,
                      request,
                      keeper.current.keyFor("fabric-selection"),
                    );
                    keeper.current.clear("fabric-selection");
                    update({
                      ...input,
                      fabric: { ...input.fabric, selection: result.selection },
                    });
                  } catch (e) {
                    setActionError(e);
                  } finally {
                    setFabricSelectionPending(false);
                  }
                }}
              />
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fabric-width">Usable width</Label>
                <Input
                  id="fabric-width"
                  inputMode="decimal"
                  value={input.fabric.enteredWidth?.value ?? ""}
                  className="min-h-11"
                  placeholder="For example, 45 in"
                  onChange={(e) => {
                    const raw = e.target.value;
                    const widthMm =
                      raw && !Number.isNaN(Number(raw)) ? Math.round(Number(raw) * 25.4) : null;
                    update({
                      ...input,
                      fabric: {
                        ...input.fabric,
                        enteredWidth: raw ? { value: raw, unit: "in" } : null,
                        widthMm,
                      },
                    });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Entered in inches. Converted value:{" "}
                  {input.fabric.widthMm ? `${input.fabric.widthMm} mm` : "not entered"}.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fabric-length">Usable length</Label>
                <Input
                  id="fabric-length"
                  inputMode="decimal"
                  value={input.fabric.enteredLength?.value ?? ""}
                  className="min-h-11"
                  placeholder="For example, 3 yd"
                  onChange={(e) => {
                    const raw = e.target.value;
                    const lengthMm =
                      raw && !Number.isNaN(Number(raw)) ? Math.round(Number(raw) * 914.4) : null;
                    update({
                      ...input,
                      fabric: {
                        ...input.fabric,
                        enteredLength: raw ? { value: raw, unit: "yd" } : null,
                        lengthMm,
                      },
                    });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Entered in yards. Converted value:{" "}
                  {input.fabric.lengthMm ? `${input.fabric.lengthMm} mm` : "not entered"}.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["directionality", "Pattern direction matters", input.fabric.directionality],
                  ["stretch", "Fabric stretches", input.fabric.stretch],
                ] as const
              ).map(([field, label, value]) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`fabric-${field}`}>{label}</Label>
                  <select
                    id={`fabric-${field}`}
                    value={value}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={(e) =>
                      update({ ...input, fabric: { ...input.fabric, [field]: e.target.value } })
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="unknown">Not sure</option>
                  </select>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="fabric-shrinkage">Shrinkage</Label>
                <select
                  id="fabric-shrinkage"
                  value={input.fabric.shrinkage}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(e) =>
                    update({
                      ...input,
                      fabric: {
                        ...input.fabric,
                        shrinkage: e.target.value as ProjectInput["fabric"]["shrinkage"],
                      },
                    })
                  }
                >
                  <option value="preshrunk">Pre-shrunk</option>
                  <option value="not_preshrunk">Not pre-shrunk</option>
                  <option value="unknown">Not sure</option>
                </select>
              </div>
            </div>
          </section>
        ) : null}

        {step === "design" ? (
          <section className="max-w-2xl space-y-5" aria-label="Design">
            <p className="text-sm text-muted-foreground">
              Person reference: neutral mannequin. Photo person reference is{" "}
              {me.data?.capabilities.personUpload
                ? "available with separate consent in your account settings"
                : "not available in this version"}
              , so no person photo is used.
            </p>
            {template.isPending ? (
              <Skeleton className="h-32" />
            ) : template.data ? (
              template.data.designOptions.map((option) => (
                <fieldset key={option.id} className="space-y-2">
                  <legend className="text-sm font-semibold">{option.label}</legend>
                  <RadioGroup
                    value={input.design.optionIds[option.id] ?? ""}
                    onValueChange={(v) =>
                      update({
                        ...input,
                        design: {
                          ...input.design,
                          optionIds: { ...input.design.optionIds, [option.id]: v },
                        },
                      })
                    }
                  >
                    {option.choices.map((choice) => (
                      <div key={choice.id} className="flex items-center gap-3">
                        <RadioGroupItem value={choice.id} id={`design-${option.id}-${choice.id}`} />
                        <Label htmlFor={`design-${option.id}-${choice.id}`}>{choice.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </fieldset>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose a garment template in the Overview step to see design options.
              </p>
            )}
            <p className="text-sm">
              Generating a concept uses {me.data?.jobQuotes.generate_concept ?? 0} pilot credit(s).
              It saves and freezes your current inputs first, so the result always matches a saved
              version.
            </p>
            <Button
              type="button"
              className="min-h-11"
              disabled={!input.fabric.selection}
              onClick={() => void runSequence("concept")}
            >
              Generate concept
            </Button>
            {!input.fabric.selection ? (
              <p className="text-sm text-muted-foreground">
                Confirm a fabric swatch in the Fabric step before generating.
              </p>
            ) : null}
            {job.data ? (
              <JobStatusPanel
                job={job.data}
                onCancel={(j, key) => {
                  void tailorApi
                    .cancelJob(j.id, key)
                    .then(() => job.refetch())
                    .catch((e) => setActionError(e));
                }}
                onRetry={(j, key) => {
                  void tailorApi
                    .retryJob(j.id, {}, key)
                    .then(() => job.refetch())
                    .catch((e) => setActionError(e));
                }}
              />
            ) : null}
            <ConceptViewer
              conceptAssetId={conceptResult?.asset.id ?? input.selectedConceptAssetId}
              fabricAssetId={input.fabric.selection?.cropAssetId ?? null}
              frozenLabels={frozenLabels}
              assetUrl={(id) => tailorApi.ownerAssetUrl(id)}
            />
            {conceptResult ? (
              <Button
                type="button"
                className="min-h-11"
                onClick={() => update({ ...input, selectedConceptAssetId: conceptResult.asset.id })}
              >
                Use this concept
              </Button>
            ) : null}
          </section>
        ) : null}

        {step === "measurements" ? (
          <section className="max-w-2xl space-y-6" aria-label="Measurements">
            <p className="text-sm">
              Enter measurements by hand. They are not estimated from photos, and only a reviewer
              can mark them verified.
            </p>
            {template.data ? (
              template.data.measurementFields.map((field) => {
                const existing = input.measurements.find((m) => m.name === field.name);
                return (
                  <MeasurementField
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    kind={field.kind}
                    required={field.required}
                    unit={field.unit}
                    guidance={field.guidance}
                    value={existing?.enteredValue ?? ""}
                    source={
                      existing?.source === "tailor_manual" ? "tailor_manual" : "customer_manual"
                    }
                    verificationStatus="unverified"
                    onChange={(raw) => {
                      const parsed = raw.trim() === "" ? null : Number(raw);
                      const valueMm =
                        parsed === null || Number.isNaN(parsed)
                          ? null
                          : Math.round(
                              parsed * (field.unit === "cm" ? 10 : field.unit === "in" ? 25.4 : 1),
                            );
                      const next: ProjectInput["measurements"][number] = {
                        name: field.name,
                        kind: field.kind,
                        valueMm,
                        enteredValue: raw || null,
                        enteredUnit: field.unit,
                        source:
                          existing?.source === "tailor_manual"
                            ? "tailor_manual"
                            : "customer_manual",
                        sourceAssetId: null,
                        recordedAt: raw ? new Date().toISOString() : null,
                      };
                      update({
                        ...input,
                        measurements: [
                          ...input.measurements.filter((m) => m.name !== field.name),
                          ...(raw ? [next] : []),
                        ],
                      });
                    }}
                    onSourceChange={(source) => {
                      if (!existing) return;
                      update({
                        ...input,
                        measurements: input.measurements.map((m) =>
                          m.name === field.name
                            ? {
                                ...m,
                                source: source as ProjectInput["measurements"][number]["source"],
                              }
                            : m,
                        ),
                      });
                    }}
                  />
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose a garment template to see its measurements.
              </p>
            )}
            <Button type="button" className="min-h-11" onClick={() => void runSequence("checks")}>
              Save and check requirements
            </Button>
            {checks ? (
              <div className="space-y-3">
                <ConstraintCard constraint={checks.constraint} />
                {checks.missingMeasurements.length ? (
                  <p className="text-sm">Still missing: {checks.missingMeasurements.join(", ")}</p>
                ) : null}
                {checks.unverifiedMeasurements.length ? (
                  <p className="text-sm">
                    Entered but not verified: {checks.unverifiedMeasurements.join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "brief" ? (
          <section className="max-w-2xl space-y-5" aria-label="Brief">
            <p className="text-sm">
              Add questions for your tailor. Correct facts here or in earlier steps, then compile
              again. Compiled brief text itself is not edited directly.
            </p>
            {input.customerQuestions.map((q, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`question-${index}`}>Question {index + 1}</Label>
                  <Textarea
                    id={`question-${index}`}
                    value={q}
                    maxLength={500}
                    onChange={(e) =>
                      update({
                        ...input,
                        customerQuestions: input.customerQuestions.map((item, i) =>
                          i === index ? e.target.value : item,
                        ),
                      })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-6 min-h-11"
                  onClick={() =>
                    update({
                      ...input,
                      customerQuestions: input.customerQuestions.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            {input.customerQuestions.length < 10 ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  update({ ...input, customerQuestions: [...input.customerQuestions, ""] })
                }
              >
                Add a question
              </Button>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11" onClick={() => void runSequence("brief")}>
                Compile brief
              </Button>
            </div>
            {briefJob.data ? <JobStatusPanel job={briefJob.data} /> : null}
            {compiledBrief.data ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Brief {compiledBrief.data.briefNumber} is ready as a {compiledBrief.data.state}{" "}
                  draft.
                </p>
                {compiledBrief.data.blockers.length ? (
                  <Alert role="alert">
                    <AlertTitle>Before finalizing</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5">
                        {compiledBrief.data.blockers.map((b) => (
                          <li key={b.code}>{b.message}</li>
                        ))}
                      </ul>
                      <p className="mt-2">
                        Finalizing keeps these warnings on the brief. Acceptance by a tailor stays
                        blocked until they are resolved.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={finalize.isPending}
                  onClick={() => finalize.mutate()}
                >
                  {finalize.isPending
                    ? "Finalizing"
                    : `Finalize version ${compiledBrief.data.briefNumber}`}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Finalizing a new version replaces earlier review links. Old approvals do not carry
                  over.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "handoff" ? (
          <section className="max-w-2xl space-y-4" aria-label="Handoff">
            {project.data.project.latestBriefId ? (
              <>
                <p className="text-sm">
                  Your finalized brief is ready to open, print and share for review.
                </p>
                <Button asChild className="min-h-11">
                  <Link
                    to="/tailor/projects/$projectId/brief"
                    params={{ projectId }}
                    search={{ step: "overview" }}
                  >
                    Open brief and share
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm">
                  There is no finalized brief yet. Compile and finalize one in the Brief step, then
                  share it from the brief page.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    void navigate({
                      to: "/tailor/projects/$projectId",
                      params: { projectId },
                      search: { step: "brief" },
                    })
                  }
                >
                  Go to Brief step
                </Button>
              </>
            )}
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving" : "Save draft"}
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => {
              const order: WorkspaceStep[] = [
                "overview",
                "fabric",
                "design",
                "measurements",
                "brief",
                "handoff",
              ];
              const next = order[
                Math.min(order.indexOf(step) + 1, order.length - 1)
              ] as WorkspaceStep;
              void navigate({
                to: "/tailor/projects/$projectId",
                params: { projectId },
                search: { step: next },
              });
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    </TailorAppShell>
  );
}
