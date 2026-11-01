import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { DesignPreview } from "@/components/DesignPreview";

export const Route = createFileRoute("/studio")({
  head: () => ({ meta: [
    { title: "Outfit design studio | Fashley" },
    { name: "description", content: "Upload your Ankara, kente, lace or adire. Choose a cut and see outfit designs in your print." },
    { property: "og:title", content: "Outfit design studio | Fashley" },
    { property: "og:description", content: "Upload your Ankara, kente, lace or adire. Choose a cut and see outfit designs in your print." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <DesignPreview kind="outfits" />
    </div>
  ),
});
