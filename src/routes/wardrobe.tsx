import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { DesignPreview } from "@/components/DesignPreview";

export const Route = createFileRoute("/wardrobe")({
  head: () => ({
    meta: [
      { title: "My wardrobe | Fashley" },
      { name: "description", content: "Keep your saved designs in collections. Find a favourite outfit or matching bag to show your tailor." },
      { property: "og:title", content: "My wardrobe | Fashley" },
      { property: "og:description", content: "Keep your saved designs in collections. Find a favourite outfit or matching bag to show your tailor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <DesignPreview wardrobe />
    </div>
  ),
});
