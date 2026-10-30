import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

type KnownPath = "/" | "/discover" | "/studio" | "/wardrobe" | "/auth" | "/shop";

export function BackButton({
  fallback = "/",
  label = "Back",
  className = "",
}: {
  fallback?: KnownPath;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      to={fallback}
      onClick={(event) => {
        if (window.history.length > 1) {
          event.preventDefault();
          window.history.back();
        }
      }}
      className={`inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
