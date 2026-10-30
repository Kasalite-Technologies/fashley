import { createFileRoute } from "@tanstack/react-router";
import { DesignStudio } from "@/components/DesignStudio";

export const Route = createFileRoute("/studio")({
  head: () => ({ meta: [
    { title: "Outfit design studio | Fashley" },
    { name: "description", content: "Upload your Ankara, kente, lace or adire. Choose a cut and see outfit ideas to discuss with your tailor." },
    { property: "og:title", content: "Outfit design studio | Fashley" },
    { property: "og:description", content: "Upload your Ankara, kente, lace or adire. Choose a cut and see outfit ideas to discuss with your tailor." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <DesignStudio kind="outfits" />,
});