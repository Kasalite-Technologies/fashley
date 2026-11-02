import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { Camera, Download, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { StudioShell } from "@/components/StudioShell";
import { DesignPreview } from "@/components/DesignPreview";
import { TailorSignInPanel, clerkConfigured } from "@/components/tailor/TailorClerk";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DESIGN_OPTIONS, HARDWARE, type DesignKind } from "@/lib/design-options";
import { prepareFabric, type FabricCheck } from "@/lib/fabric";

const OCCASIONS = ["Everyday", "Work", "Church", "Wedding", "Party", "Formal event"];
const KIND_ROUTES = {
  outfits: "/studio",
  shoes: "/shoe-design",
  bags: "/bag-design",
} as const satisfies Record<DesignKind, string>;

interface Preferences {
  kind: DesignKind;
  category: string;
  occasion: string;
  style: string;
  hardware: string;
  notes: string;
}

interface GeneratedImage {
  imageBase64: string;
  preferences: Preferences;
}

/* Pattern adapted from 21st.dev tag/toggle groups: the options are few
   (five to seven), so showing them as chips beats hiding them in a
   dropdown. One click instead of three, and the choice stays visible. */
function ChipGroup({
  id,
  label,
  values,
  value,
  onChange,
}: {
  id: string;
  label: string;
  values: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      <div className="chip-group" role="group" aria-labelledby={id}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className="chip"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("This file could not be read."));
    reader.readAsDataURL(file);
  });
}

function SignedOutStudio({ kind }: { kind: DesignKind }) {
  return (
    <>
      <DesignPreview
        kind={kind}
        cta={
          <Button asChild size="lg" className="mt-6">
            <Link to="/sign-in" search={{ redirectTo: KIND_ROUTES[kind], mode: "in" }}>
              Sign in to design
            </Link>
          </Button>
        }
      />
    </>
  );
}

function Studio({ kind }: { kind: DesignKind }) {
  const { getToken } = useAuth();
  const options = DESIGN_OPTIONS[kind];
  const [fabric, setFabric] = useState<FabricCheck | null>(null);
  const [category, setCategory] = useState(options.categories[0] ?? "");
  const [style, setStyle] = useState(options.styles[0] ?? "");
  const [occasion, setOccasion] = useState(OCCASIONS[0] ?? "Everyday");
  const [hardware, setHardware] = useState("Gold");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(3);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  async function authHeaders() {
    const token = await getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // Take a photo with the real camera where getUserMedia exists. Where it
  // does not (insecure context, denied permission, older browser), fall
  // back to the capture file input, which opens the camera app on phones.
  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      toast.error("Camera unavailable here. Opening the photo picker instead.");
      cameraRef.current?.click();
    }
  }

  // Attach the stream once the dialog (and its <video>) has mounted.
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("That photo could not be taken. Try again.");
          return;
        }
        setCameraOpen(false);
        stopCamera();
        void onFile(new File([blob], "fabric-photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  async function onFile(file?: File) {
    if (!file) return;
    try {
      setFabric(await prepareFabric(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This file could not be read.");
    }
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Drop an image file, such as a JPG or PNG photo.");
      return;
    }
    void onFile(file);
  }

  async function generate() {
    if (!fabric || running) return;
    setRunning(true);
    setResults([]);
    setSaved({});
    try {
      const preferences: Preferences = { kind, category, occasion, style, hardware, notes };
      const imageDataUrl = await readAsDataUrl(fabric.file);
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ imageDataUrl, preferences, count }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: { images: { imageBase64: string }[]; warnings?: string[] };
        error?: { message?: string };
      } | null;
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? "Generation failed. Please try again.");
      }
      setResults(payload.data.images.map((img) => ({ imageBase64: img.imageBase64, preferences })));
      for (const w of payload.data.warnings ?? []) toast.warning(w);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  async function save(index: number) {
    const result = results[index];
    if (!result || saved[index] || saving[index]) return;
    setSaving((s) => ({ ...s, [index]: true }));
    try {
      const res = await fetch("/api/studio/designs", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ imageBase64: result.imageBase64, preferences: result.preferences }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) throw new Error(payload?.error?.message ?? "This design could not be saved.");
      setSaved((s) => ({ ...s, [index]: true }));
      toast.success("Saved to your wardrobe");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This design could not be saved.");
    } finally {
      setSaving((s) => ({ ...s, [index]: false }));
    }
  }

  function download(index: number) {
    const result = results[index];
    if (!result) return;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${result.imageBase64}`;
    a.download = `fashley-${kind}-design-${index + 1}.png`;
    a.click();
  }

  return (
    <StudioShell title={`${options.title} studio`}>
      <div className="studio-workbench">
        <section className="studio-controls">
          <h2 className="font-sans text-lg font-semibold tracking-tight">
            Your {options.material} photo
          </h2>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label={`Upload your ${options.material} photo`}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {/* capture="environment" opens the rear camera directly on phones,
              so the fabric can be photographed in place instead of hunted
              through the photo library. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label={`Take a photo of your ${options.material}`}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            aria-label={
              fabric
                ? `Change your ${options.material} photo`
                : `Upload your ${options.material} photo by clicking or dropping a file`
            }
            className={`material-upload mt-3 cursor-pointer rounded-lg border border-dashed p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
              dragging ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
            }`}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {fabric ? (
              <span className="dropzone-preview">
                <img src={fabric.previewUrl} alt="Your uploaded material" />
                <span className="dropzone-change">Change photo</span>
              </span>
            ) : (
              <span className="dropzone-empty">
                <ImagePlus className="h-8 w-8" aria-hidden="true" />
                <span className="dropzone-title">Drop your {options.material} photo here</span>
                <span className="dropzone-hint">
                  or click to browse. JPG or PNG, in clear light.
                </span>
              </span>
            )}
          </button>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 w-full rounded-full"
            onClick={() => void openCamera()}
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            {fabric ? "Retake photo" : "Take a photo"}
          </Button>
          {fabric &&
            fabric.warnings.map((w) => (
              <p key={w} className="mt-2 text-sm text-muted-foreground">
                {w}
              </p>
            ))}

          <h2 className="mt-8 font-sans text-lg font-semibold tracking-tight">Design choices</h2>
          <div className="mt-3 space-y-5">
            <ChipGroup
              id="studio-category"
              label={options.label}
              values={options.categories}
              value={category}
              onChange={setCategory}
            />
            <ChipGroup
              id="studio-style"
              label="Style"
              values={options.styles}
              value={style}
              onChange={setStyle}
            />
            <ChipGroup
              id="studio-occasion"
              label="Occasion"
              values={OCCASIONS}
              value={occasion}
              onChange={setOccasion}
            />
            {kind !== "outfits" && (
              <ChipGroup
                id="studio-hardware"
                label="Hardware"
                values={HARDWARE}
                value={hardware}
                onChange={setHardware}
              />
            )}
            <div className="space-y-1.5">
              <Label htmlFor="studio-notes">Extra details (optional)</Label>
              <Input
                id="studio-notes"
                value={notes}
                maxLength={200}
                placeholder={options.example}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <p id="studio-count" className="text-sm font-medium">
                How many designs
              </p>
              <div className="chip-group" role="group" aria-labelledby="studio-count">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="chip"
                    onClick={() => setCount(n)}
                    aria-pressed={count === n}
                  >
                    {n} designs
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            className="mt-6 w-full rounded-full"
            size="lg"
            disabled={!fabric || running}
            onClick={() => void generate()}
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              "Generate designs"
            )}
          </Button>
          {!fabric && <p className="mt-2 text-sm text-muted-foreground">Upload a photo first.</p>}
        </section>

        <section className="studio-canvas" aria-live="polite" aria-busy={running}>
          <h2 className="font-sans text-lg font-semibold tracking-tight">Your designs</h2>
          {running && (
            <>
              <p className="mt-4 text-sm text-muted-foreground" role="status">
                Generating your designs. This can take a minute.
              </p>
              {/* Skeleton tiles match the result grid, so the layout does not
                  jump when the real designs land. */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2" aria-hidden="true">
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="result-skeleton" />
                ))}
              </div>
            </>
          )}
          {!running && results.length === 0 && (
            <div className="canvas-empty">
              <span>Room for your next idea.</span>
              <p>
                Upload your material and choose the details on the left. Your design previews will
                appear here, ready to compare and save.
              </p>
              <p>Concept previews, not sewing patterns.</p>
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {results.map((r, i) => (
              <figure key={i} className="result-card">
                <img
                  src={`data:image/png;base64,${r.imageBase64}`}
                  alt={`Generated ${kind} design ${i + 1}`}
                  className="aspect-square w-full object-cover"
                />
                <figcaption className="mt-2 text-sm text-muted-foreground">
                  {r.preferences.category} · {r.preferences.style}
                </figcaption>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={saved[i] || saving[i]} onClick={() => void save(i)}>
                    {saved[i] ? "Saved" : saving[i] ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => download(i)}>
                    <Download className="h-4 w-4" /> Download
                  </Button>
                </div>
              </figure>
            ))}
          </div>
        </section>
      </div>
      <Dialog
        open={cameraOpen}
        onOpenChange={(open) => {
          setCameraOpen(open);
          if (!open) stopCamera();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Take a photo of your {options.material}</DialogTitle>
          </DialogHeader>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-[4/3] w-full rounded-2xl bg-black object-cover"
            aria-label="Camera preview"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-full"
              onClick={() => {
                setCameraOpen(false);
                stopCamera();
              }}
            >
              Cancel
            </Button>
            <Button type="button" className="min-h-11 rounded-full" onClick={capturePhoto}>
              <Camera className="h-4 w-4" aria-hidden="true" /> Take photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioShell>
  );
}

export function StudioApp({ kind }: { kind: DesignKind }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-5 py-12" role="status">
          Loading your design studio…
        </main>
      </div>
    );
  }
  if (isSignedIn) {
    return (
      <div className="min-h-screen">
        <Studio kind={kind} />
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <SignedOutStudio kind={kind} />
    </div>
  );
}

export function StudioGate({ kind }: { kind: DesignKind }) {
  if (!clerkConfigured) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <DesignPreview kind={kind} />
        <section className="mx-auto max-w-md px-5 pb-16">
          <TailorSignInPanel redirectTo={KIND_ROUTES[kind]} />
        </section>
      </div>
    );
  }
  return <StudioApp kind={kind} />;
}
