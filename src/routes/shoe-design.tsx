import { createFileRoute } from "@tanstack/react-router";
import { DesignStudio } from "@/components/DesignStudio";

export const Route = createFileRoute("/shoe-design")({
  head: () => ({ meta: [
    { title: "Shoe design studio | Fashley" },
    { name: "description", content: "See shoe ideas from your fabric or leather photo. Choose the shoe type, style and hardware." },
    { property: "og:title", content: "Shoe design studio | Fashley" },
    { property: "og:description", content: "See shoe ideas from your fabric or leather photo. Choose the shoe type, style and hardware." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <DesignStudio kind="shoes" />,
});