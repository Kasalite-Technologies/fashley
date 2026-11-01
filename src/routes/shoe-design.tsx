import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { DesignPreview } from "@/components/DesignPreview";

export const Route = createFileRoute("/shoe-design")({
  head: () => ({ meta: [
    { title: "Shoe design studio | Fashley" },
    { name: "description", content: "See shoe ideas from your fabric or leather photo. Choose the shoe type, style and hardware." },
    { property: "og:title", content: "Shoe design studio | Fashley" },
    { property: "og:description", content: "See shoe ideas from your fabric or leather photo. Choose the shoe type, style and hardware." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <DesignPreview kind="shoes" />
    </div>
  ),
});
