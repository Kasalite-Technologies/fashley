import { useEffect, useState } from "react";
import { Facebook, Link2, Loader2, MessageCircle, Send, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { dataUrlToBlob } from "@/lib/fabric";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const LINK_TTL_SECONDS = 60 * 60 * 24; // 24 hours

type DesignShareSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Data URL of an unsaved design — uploaded privately so a share link can be created. */
  imageSrc?: string | null;
  /** Storage path of a saved design — a fresh share link is created from it. */
  imagePath?: string | null;
};

type Target = { label: string; icon: typeof MessageCircle; href: string };

export function DesignShareSheet({ open, onOpenChange, title, imageSrc, imagePath }: DesignShareSheetProps) {
  const { session } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLink(null);
    setBlob(null);
    setError(null);
    setPreparing(true);
    (async () => {
      try {
        let path = imagePath ?? null;
        let fileBlob: Blob | null = null;
        if (!path && imageSrc) {
          const uid = session?.user.id;
          if (!uid) throw new Error("Sign in to share designs.");
          fileBlob = await dataUrlToBlob(imageSrc);
          path = `${uid}/shares/${crypto.randomUUID()}.png`;
          const up = await supabase.storage.from("designs").upload(path, fileBlob, { contentType: "image/png" });
          if (up.error) throw up.error;
        }
        if (!path) throw new Error("There’s no design to share yet.");
        const { data, error: urlError } = await supabase.storage.from("designs").createSignedUrls([path], LINK_TTL_SECONDS);
        const signed = data?.[0]?.signedUrl;
        if (urlError || !signed) throw urlError ?? new Error("We couldn’t create a share link. Please try again.");
        if (cancelled) return;
        setBlob(fileBlob);
        setLink(signed);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "We couldn’t share this design. Please try again.");
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, imageSrc, imagePath, attempt, session?.user.id]);

  const text = `${title}, made with Fashley`;
  // wa.me redirects desktop browsers through api.whatsapp.com, which many
  // browsers/extensions block; web.whatsapp.com works on desktop, wa.me on phones.
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const whatsappBase = isMobile ? "https://wa.me/?text=" : "https://web.whatsapp.com/send?text=";
  const targets: Target[] = link
    ? [
        { label: "WhatsApp", icon: MessageCircle, href: `${whatsappBase}${encodeURIComponent(`${text} ${link}`)}` },
        { label: "X", icon: Twitter, href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}` },
        { label: "Facebook", icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
        { label: "Telegram", icon: Send, href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}` },
      ]
    : [];

  const canShareFile =
    !!blob && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [new File([blob], "fashley-design.png", { type: "image/png" })] });

  async function nativeShare() {
    if (!blob) return;
    const file = new File([blob], "fashley-design.png", { type: "image/png" });
    try {
      await navigator.share({ files: [file], title });
    } catch {
      /* user dismissed the share sheet */
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Share link copied");
    } catch {
      toast.error("We couldn’t copy the link. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share your design</DialogTitle>
          <DialogDescription>Send your design to your tailor or friends. Choose an app or copy the link.</DialogDescription>
        </DialogHeader>
        {preparing && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing your share link…
          </p>
        )}
        {error && (
          <div className="py-2 text-sm">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </Button>
          </div>
        )}
        {link && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {targets.map((t) => (
                <Button key={t.label} variant="outline" asChild>
                  <a href={t.href} target="_blank" rel="noopener noreferrer">
                    <t.icon className="h-4 w-4" /> {t.label}
                  </a>
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={copyLink}>
                <Link2 className="h-4 w-4" /> Copy link
              </Button>
              {canShareFile && (
                <Button variant="secondary" onClick={nativeShare}>
                  <Share2 className="h-4 w-4" /> Share image…
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Anyone with this link can view and save the image. The link expires after 24 hours.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
