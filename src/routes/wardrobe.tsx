import { createFileRoute } from "@tanstack/react-router";
import { WardrobeApp } from "@/components/WardrobeApp";

export const Route = createFileRoute("/wardrobe")({
  head: () => ({
    meta: [
      { title: "My wardrobe | Fashley" },
      { name: "description", content: "Your saved Fashley designs." },
      { property: "og:title", content: "My wardrobe | Fashley" },
      { property: "og:description", content: "Your saved Fashley designs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WardrobeApp,
});
