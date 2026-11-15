import { useState } from "react";
import { toast } from "sonner";
import { eventsApi, EventApiError } from "@/lib/events/client/api";
import { Button } from "@/components/ui/button";

/**
 * Door check-in. The camera path uses the browser's native BarcodeDetector
 * where available; manual entry always works, so a missing camera API never
 * blocks admission. Opening a ticket link cannot check anyone in: only this
 * authenticated, event-scoped request can.
 */
export function ReviewCheckIn({ eventId }: { eventId: string }) {
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "repeat" | "error"; message: string } | null>(
    null,
  );

  async function submit(code: string) {
    if (!code.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const data = await eventsApi.checkIn(eventId, code.trim());
      setResult({
        kind: data.state === "checked_in" ? "ok" : "repeat",
        message:
          data.state === "checked_in"
            ? `${data.displayName} checked in at ${new Date(data.checkedInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
            : `${data.displayName} was already checked in at ${new Date(data.checkedInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
      });
      setCredential("");
    } catch (e) {
      setResult({
        kind: "error",
        message:
          e instanceof EventApiError ? e.failure.message : "That ticket could not be checked.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ev-panel" style={{ marginTop: 0 }}>
      <h2>Check in at the door</h2>
      <p>
        Enter the ticket code from the attendee's My events page, or scan the code when the camera
        provides one. Check-in needs an internet connection.
      </p>
      <form
        className="ev-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(credential);
        }}
      >
        <label className="ev-field">
          <span>Ticket code</span>
          <input
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the code shown on the ticket"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="ev-button" data-variant="accent" disabled={busy}>
            {busy ? "Checking…" : "Check in"}
          </Button>
          <ScanButton onScan={(value) => void submit(value)} />
        </div>
      </form>
      {result ? (
        <p className={result.kind === "error" ? "ev-error" : "ev-success"} role="status">
          {result.message}
        </p>
      ) : null}
    </section>
  );
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

function ScanButton({ onScan }: { onScan: (value: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState("");

  async function scan() {
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
      }
    ).BarcodeDetector;
    if (!Detector) {
      setNote("This browser has no built-in scanner. Enter the ticket code instead.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setNote("Camera access is not available here. Enter the ticket code instead.");
      return;
    }
    setScanning(true);
    setNote("");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      const detector = new Detector({ formats: ["qr_code"] });
      const canvas = document.createElement("canvas");
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        if (video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d")?.drawImage(video, 0, 0);
          const codes = await detector.detect(canvas).catch(() => []);
          const value = codes[0]?.rawValue;
          if (value) {
            onScan(value);
            toast.success("Ticket scanned");
            return;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      setNote("No code found in 20 seconds. Enter the ticket code instead.");
    } catch {
      setNote("The camera could not start. Enter the ticket code instead.");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setScanning(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        className="ev-button"
        data-variant="quiet"
        onClick={() => void scan()}
        disabled={scanning}
      >
        {scanning ? "Scanning…" : "Scan a ticket"}
      </Button>
      {note ? <p className="ev-error">{note}</p> : null}
    </div>
  );
}
