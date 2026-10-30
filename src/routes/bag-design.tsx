import { createFileRoute } from "@tanstack/react-router";
import { DesignStudio } from "@/components/DesignStudio";

export const Route = createFileRoute("/bag-design")({
  head: () => ({ meta: [
    { title: "Bag design studio | Fashley" },
    { name: "description", content: "See a tote or clutch in your fabric or leather. Choose the bag shape and hardware before you save a design." },
    { property: "og:title", content: "Bag design studio | Fashley" },
    { property: "og:description", content: "See a tote or clutch in your fabric or leather. Choose the bag shape and hardware before you save a design." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <DesignStudio kind="bags" />,
});