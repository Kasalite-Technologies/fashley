import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  isTerminalJob,
  pollIntervalForJob,
  pollUploadUntilSettled,
  seededJobIds,
  withoutSelectedConcept,
} from "@/components/tailor/jobRecovery";
import {
  convertMeasurementValue,
  countFilledMeasurements,
  isMeasurementsComplete,
  measurementInputError,
  measurementValueMm,
  type MeasurementDisplayUnit,
  type MeasurementEnteredUnit,
} from "@/components/tailor/measurementHelpers";
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
    meta: [{ title: "Your outfit project | Fashley" }, { name: "robots", content: "noindex" }],
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
  const [analyzeJobId, setAnalyzeJobId] = useState<string | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [briefJobId, setBriefJobId] = useState<string | null>(null);
  const [compiledBriefId, setCompiledBriefId] = useState<string | null>(null);
  const [measurementUnitOverride, setMeasurementUnitOverride] =
    useState<MeasurementDisplayUnit | null>(null);
  const [selectingConcept, setSelectingConcept] = useState(false);
  const terminalHandled = useRef(new Set<string>());

  useEffect(() => {
    if (project.data && input === null) {
      setInput(project.data.draft.input);
      setDraftVersion(project.data.draft.version);
      setProjectVersion(project.data.project.version);
      // Reload recovery: resume whichever job the server last ran, by type.
      // Functional guards keep a job started this session from being reseeded.
      const seeded = seededJobIds(project.data.latestJob);
      if (seeded.activeJobId) setActiveJobId((prev) => prev ?? seeded.activeJobId);
      if (seeded.analyzeJobId) setAnalyzeJobId((prev) => prev ?? seeded.analyzeJobId);
      if (seeded.briefJobId) setBriefJobId((prev) => prev ?? seeded.briefJobId);
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
    refetchInterval: (query) => pollIntervalForJob(query.state.data as Job | undefined),
  });

  const analyzeJob = useQuery({
    queryKey: tailorKeys.job(userId, analyzeJobId ?? "none"),
    queryFn: () => tailorApi.getJob(analyzeJobId as string),
    enabled: Boolean(analyzeJobId),
    retry: false,
    refetchInterval: (query) => pollIntervalForJob(query.state.data as Job | undefined),
  });

  // On terminal completion, refresh project/brief so restored state (for
  // example a compiled brief) loads through the normal queries.
  useEffect(() => {
    for (const tracked of [job.data, analyzeJob.data]) {
      if (!tracked || !isTerminalJob(tracked)) continue;
      const key = `${tracked.id}:${tracked.state}`;
      if (terminalHandled.current.has(key)) continue;
      terminalHandled.current.add(key);
      void queryClient.invalidateQueries({
        queryKey: tailorKeys.project(userId, projectId),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.data, analyzeJob.data]);

  function jobPanelHandlers(refetch: () => unknown) {
    return {
      onCancel: (j: Job, key: string) => {
        void tailorApi
          .cancelJob(j.id, key)
          .then(() => refetch())
          .catch((e) => setActionError(e));
      },
      onRetry: (j: Job, key: string, acknowledge: boolean) => {
        void tailorApi
          .retryJob(
            j.id,
            acknowledge ? { acknowledgePossibleProviderCost: true } : {},
            key,
          )
          .then(() => refetch())
          .catch((e) => setActionError(e));
      },
    };
  }

  async function selectConcept(assetId: string) {
    if (!input) return;
    const next = { ...input, selectedConceptAssetId: assetId };
    setSelectingConcept(true);
    setActionError(null);
    try {
      await saveDraft(next);
      setInput(next);
    } catch (e) {
      setActionError(e);
    } finally {
      setSelectingConcept(false);
    }
  }

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

  async function runSequence(action: "concept" | "checks" | "brief" | "analyze") {
    if (!input) return;
    setActionError(null);
    try {
      // A new concept supersedes any earlier selection; clear it in the
      // draft that is about to be frozen so it cannot go stale.
      const effective = action === "concept" ? withoutSelectedConcept(input) : input;
      if (effective !== input) setInput(effective);
      const revision = await saveThenFreeze(effective);
      if (action === "concept") {
        const started = await tailorApi.startJob(
          projectId,
          { type: "generate_concept", revisionId: revision.id },
          keeper.current.keyFor("generate-concept"),
        );
        keeper.current.clear("generate-concept");
        setActiveJobId(started.job.id);
      } else if (action === "analyze") {
        const started = await tailorApi.startJob(
          projectId,
          { type: "analyze_fabric", revisionId: revision.id },
          keeper.current.keyFor("analyze-fabric"),
        );
        keeper.current.clear("analyze-fabric");
        setAnalyzeJobId(started.job.id);
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
    refetchInterval: (query) => pollIntervalForJob(query.state.data as Job | undefined),
  });
  useEffect(() => {
    if (briefJob.data?.result?.type === "assemble_brief")
      setCompiledBriefId(briefJob.data.result.briefId);
    if (briefJob.data && isTerminalJob(briefJob.data)) {
      const key = `${briefJob.data.id}:${briefJob.data.state}`;
      if (!terminalHandled.current.has(key)) {
        terminalHandled.current.add(key);
        void queryClient.invalidateQueries({
          queryKey: tailorKeys.project(userId, projectId),
        });
        if (briefJob.data.result?.type === "assemble_brief") {
          void queryClient.invalidateQueries({
            queryKey: tailorKeys.brief(userId, briefJob.data.result.briefId),
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const completed = await tailorApi.completeUpload(
        projectId,
        intent.uploadId,
        keeper.current.keyFor("fabric-complete"),
      );
      keeper.current.clear("fabric-complete");
      const status =
        completed.status === "ready" || completed.status === "rejected" || completed.status === "expired"
          ? completed
          : await pollUploadUntilSettled(
              () => tailorApi.getUpload(projectId, intent.uploadId),
              { initial: completed },
            );
      if (status.status !== "ready" || !status.asset) {
        setFabricStatus(
          status.error?.message ??
            (status.status === "ready"
              ? "Image check finished without a usable photo. Upload another photo."
              : "Image is still being checked. Wait a moment, then upload again if it does not finish."),
        );
        return;
      }
      setFabricStatus("Photo ready");
      update({
        ...withoutSelectedConcept(input),
        fabric: {
          ...input.fabric,
          sourceAssetId: status.asset.id,
          selection: null,
        },
      });
    } catch (e) {
      setFabricStatus(null);
      setActionError(e);
    }
  }

  if (project.isPending || !input) {
    return (
      <TailorAppShell title="Your outfit project">
        <Skeleton className="h-64" />
      </TailorAppShell>
    );
  }
  if (project.isError) {
    return (
      <TailorAppShell title="Your outfit project">
        <PageError error={project.error} onRetry={() => void project.refetch()} />
      </TailorAppShell>
    );
  }

  const completed: WorkspaceStep[] = [];
  if (input.fabric.selection) completed.push("fabric");
  if (input.selectedConceptAssetId) completed.push("design");
  if (isMeasurementsComplete(input.measurements, template.data?.measurementFields ?? null))
    completed.push("measurements");
  const defaultMeasurementUnit: MeasurementDisplayUnit =
    (template.data?.measurementFields.find((f) => f.unit === "cm" || f.unit === "in")
      ?.unit as MeasurementDisplayUnit | undefined) ??
    me.data?.preferences.measurementUnit ??
    "cm";
  const activeMeasurementUnit: MeasurementDisplayUnit =
    measurementUnitOverride ?? defaultMeasurementUnit;
  const conceptResult = job.data?.result?.type === "generate_concept" ? job.data.result : null;
  const analyzeResult =
    analyzeJob.data?.result?.type === "analyze_fabric" ? analyzeJob.data.result : null;
  const fabricAnalysis =
    analyzeJob.data?.state === "completed" &&
    analyzeResult &&
    analyzeResult.segmentation.status === "completed" &&
    analyzeResult.sourceAssetId === input.fabric.sourceAssetId
      ? { analysisJobId: analyzeJob.data.id, regions: analyzeResult.segmentation.regions }
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
            Locked version: {project.data.currentRevision?.number ?? "not locked yet"}
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
            <AlertTitle>This outfit project changed elsewhere</AlertTitle>
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
          <section className="max-w-2xl space-y-5" aria-label="Your outfit">
            <p className="text-sm text-muted-foreground">
              Start here with the basics. What happens next: you will add your fabric, choose a
              design, and enter your measurements.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ov-title">Name your outfit</Label>
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
            <p className="text-sm text-muted-foreground">
              What happens next: once your fabric photo is ready, confirm a swatch from it, then
              move on to your design.
            </p>
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
              <div className="space-y-3">
                <p className="text-sm">
                  Analyze the photo to find fabric regions you can pick as a swatch. Analysis
                  suggests regions and visible-fabric observations only; it does not measure how
                  much fabric you have or guarantee fit.
                </p>
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={analyzeJob.data ? !isTerminalJob(analyzeJob.data) : false}
                  onClick={() => void runSequence("analyze")}
                >
                  {analyzeJob.data && !isTerminalJob(analyzeJob.data)
                    ? "Analyzing fabric"
                    : analyzeResult
                      ? "Analyze fabric again"
                      : "Analyze fabric"}
                </Button>
                {analyzeJob.isError ? (
                  <PageError error={analyzeJob.error} onRetry={() => void analyzeJob.refetch()} />
                ) : analyzeJob.data ? (
                  <JobStatusPanel job={analyzeJob.data} {...jobPanelHandlers(() => analyzeJob.refetch())} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No analysis yet. Manual crop below works without analysis.
                  </p>
                )}
                {analyzeJob.data?.state === "completed" && analyzeResult ? (
                  analyzeResult.segmentation.status !== "completed" ? (
                    <p className="text-sm text-muted-foreground">
                      Analysis finished without usable regions
                      {analyzeResult.segmentation.errorCode
                        ? ` (${analyzeResult.segmentation.errorCode})`
                        : ""}
                      . Manual crop below is still available.
                    </p>
                  ) : analyzeResult.segmentation.regions.length ? (
                    <div className="space-y-2">
                      <p className="text-sm">
                        Analysis completed: {analyzeResult.segmentation.regions.length} region
                        {analyzeResult.segmentation.regions.length === 1 ? "" : "s"} found. Pick
                        one below, or use manual crop.
                      </p>
                      {analyzeResult.observations.length ? (
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {analyzeResult.observations.map((o) => (
                            <li key={o.key}>
                              {o.key}: {o.value}
                              {o.uncertainty === "uncertain" ? " (uncertain)" : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm">
                      Analysis completed: 0 regions found. Manual crop below is still available.
                    </p>
                  )
                ) : null}
              </div>
            ) : null}
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
                      ...withoutSelectedConcept(input),
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
                        ...withoutSelectedConcept(input),
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
                Choose what you are making in the Your outfit step to see design options.
              </p>
            )}
            <p className="text-sm">
              Generating a concept uses {me.data?.jobQuotes.generate_concept ?? 0} pilot credit(s).
              It saves and locks your current inputs first, so the result always matches a saved
              version.
            </p>
            <p className="text-sm text-muted-foreground">
              Locking saves this exact version. Your brief is made from it. You can still make a new
              version later.
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
            {job.isError ? (
              <PageError error={job.error} onRetry={() => void job.refetch()} />
            ) : job.data ? (
              <JobStatusPanel job={job.data} {...jobPanelHandlers(() => job.refetch())} />
            ) : null}
            <ConceptViewer
              conceptAssetId={conceptResult?.asset.id ?? input.selectedConceptAssetId}
              fabricAssetId={input.fabric.selection?.cropAssetId ?? null}
              frozenLabels={frozenLabels}
              assetUrl={(id) => tailorApi.ownerAssetUrl(id)}
            />
            {conceptResult ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={
                    selectingConcept || input.selectedConceptAssetId === conceptResult.asset.id
                  }
                  onClick={() => void selectConcept(conceptResult.asset.id)}
                >
                  {selectingConcept
                    ? "Saving selection"
                    : input.selectedConceptAssetId === conceptResult.asset.id
                      ? "Concept selected"
                      : "Use this concept"}
                </Button>
                {input.selectedConceptAssetId === conceptResult.asset.id ? (
                  <Badge variant="secondary">Selected concept</Badge>
                ) : null}
              </div>
            ) : input.selectedConceptAssetId ? (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">Selected concept</Badge>
                Saved selection for this project.
              </p>
            ) : null}
          </section>
        ) : null}

        {step === "measurements" ? (
          <section className="max-w-2xl space-y-6" aria-label="Measurements">
            <p className="text-sm">
              Enter measurements by hand. They are not estimated from photos, and only a reviewer
              can mark them verified.
            </p>
            <p className="text-sm text-muted-foreground">
              What happens next: your measurements are saved with your outfit and included in the
              brief only when you choose to share them.
            </p>
            {template.data ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium" id="measurement-unit-label">
                    Unit
                  </span>
                  <div role="group" aria-labelledby="measurement-unit-label" className="flex gap-1">
                    {(["cm", "in"] as const).map((u) => (
                      <Button
                        key={u}
                        type="button"
                        size="sm"
                        variant={activeMeasurementUnit === u ? "default" : "outline"}
                        aria-pressed={activeMeasurementUnit === u}
                        className="min-h-11 min-w-11"
                        onClick={() => setMeasurementUnitOverride(u)}
                      >
                        {u}
                      </Button>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {countFilledMeasurements(input.measurements, template.data.measurementFields)}{" "}
                    of {template.data.measurementFields.length} measurements filled
                  </span>
                </div>
                {template.data.measurementFields.map((field) => {
                  const existing = input.measurements.find((m) => m.name === field.name);
                  const storedUnit: MeasurementEnteredUnit =
                    existing?.enteredUnit ?? field.unit;
                  // Before the user toggles, each field keeps its template/stored unit;
                  // after toggling, the chosen unit applies to the whole step.
                  const displayUnit: MeasurementEnteredUnit =
                    measurementUnitOverride ?? storedUnit;
                  return (
                    <MeasurementField
                      key={field.name}
                      name={field.name}
                      label={field.label}
                      kind={field.kind}
                      required={field.required}
                      unit={displayUnit}
                      guidance={field.guidance}
                      value={
                        existing?.enteredValue
                          ? convertMeasurementValue(
                              existing.enteredValue,
                              storedUnit,
                              displayUnit,
                            )
                          : ""
                      }
                      source={
                        existing?.source === "tailor_manual" ? "tailor_manual" : "customer_manual"
                      }
                      verificationStatus="unverified"
                      error={measurementInputError(existing?.enteredValue)}
                      onChange={(raw) => {
                        const enteredUnit = displayUnit as ProjectInput["measurements"][number]["enteredUnit"];
                        const next: ProjectInput["measurements"][number] = {
                          name: field.name,
                          kind: field.kind,
                          valueMm: measurementValueMm(raw, displayUnit),
                          enteredValue: raw || null,
                          enteredUnit,
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
                    />
                  );
                })}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose what you are making to see its measurements.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving" : "Save measurements"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => void runSequence("checks")}
              >
                Lock this version and check requirements
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Locking saves an exact version; the brief and checks are made from it.
            </p>
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
              Add questions for your tailor. Correct facts here or in earlier steps, then make the
              brief again. The brief text itself is not edited directly.
            </p>
            <p className="text-sm text-muted-foreground">
              Locking saves this exact version. Your brief is made from it. You can still make a new
              version later.
            </p>
            <p className="text-sm">
              Your tailor can approve the design from this brief. They can only accept the job once
              the required measurements are filled in and checked by them.
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
                Make my brief
              </Button>
            </div>
            {briefJob.isError ? (
              <PageError error={briefJob.error} onRetry={() => void briefJob.refetch()} />
            ) : briefJob.data ? (
              <JobStatusPanel job={briefJob.data} {...jobPanelHandlers(() => briefJob.refetch())} />
            ) : null}
            {compiledBrief.isError ? (
              <PageError
                error={compiledBrief.error}
                onRetry={() => void compiledBrief.refetch()}
              />
            ) : null}
            {compiledBrief.data ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Brief {compiledBrief.data.briefNumber} is ready as a {compiledBrief.data.state}{" "}
                  draft.
                </p>
                {compiledBrief.data.blockers.length ? (
                  <Alert role="alert">
                    <AlertTitle>Before you lock this version</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5">
                        {compiledBrief.data.blockers.map((b) => (
                          <li key={b.code}>{b.message}</li>
                        ))}
                      </ul>
                      <p className="mt-2">
                        Locking this version keeps these warnings on the brief. Approval by a tailor
                        stays blocked until they are resolved.
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
                    ? "Locking this version"
                    : `Lock this version (brief ${compiledBrief.data.briefNumber})`}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Locking a new version replaces earlier links sent to your tailor. Old approvals do
                  not carry over.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "handoff" ? (
          <section className="max-w-2xl space-y-4" aria-label="Send to tailor">
            {project.data.project.latestBriefId ? (
              <>
                <p className="text-sm">
                  Your locked brief is ready to open, print and send to your tailor for review.
                </p>
                <p className="text-sm text-muted-foreground">
                  Your tailor gets a link to this brief only — not your account.
                </p>
                <Button asChild className="min-h-11">
                  <Link
                    to="/tailor/projects/$projectId/brief"
                    params={{ projectId }}
                    search={{ step: "overview" }}
                  >
                    Open brief and send to tailor
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm">
                  There is no locked brief yet. Make and lock one in the Brief step, then send it
                  from the brief page.
                </p>
                <p className="text-sm text-muted-foreground">
                  Your tailor gets a link to this brief only — not your account.
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
