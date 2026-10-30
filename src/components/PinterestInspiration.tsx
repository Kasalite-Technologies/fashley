import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PinterestInspiration({ kind, category, style }: { kind: "shoes" | "bags"; category?: string; style?: string }) {
  const query = [style, category, kind === "shoes" ? "shoe design inspiration" : "handbag design inspiration"].filter(Boolean).join(" ");
  return <Button asChild variant="link" className="h-auto whitespace-normal px-0 py-2 text-sm">
    <a href={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" aria-label={`${kind === "shoes" ? "Shoe" : "Bag"} inspiration on Pinterest (opens in new tab)`}>
      Pinterest inspiration <ExternalLink />
    </a>
  </Button>;
}