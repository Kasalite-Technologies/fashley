import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface LightboxImage {
  src: string;
  alt: string;
  caption?: string;
}

/* Full-size viewer for generated and saved designs. The cards crop to a
   square, so clicking opens the whole image uncropped on a dark backdrop.
   Radix handles Escape, focus trapping and scroll lock. */
export function ImageLightbox({
  image,
  onClose,
  actions,
}: {
  image: LightboxImage | null;
  onClose: () => void;
  actions?: ReactNode;
}) {
  return (
    <Dialog
      open={image !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] w-[min(94vw,56rem)] max-w-none overflow-y-auto p-3 sm:p-4">
        <DialogTitle className="pr-10 text-base font-semibold">
          {image?.caption ?? image?.alt ?? "Design preview"}
        </DialogTitle>
        {image && (
          <img
            src={image.src}
            alt={image.alt}
            className="max-h-[76vh] w-full rounded-xl bg-[#eee8de] object-contain"
          />
        )}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </DialogContent>
    </Dialog>
  );
}
