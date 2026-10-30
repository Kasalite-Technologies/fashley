import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectStatusBadge } from "./status";

export type ProjectCardData = {
  id: string;
  title: string;
  templateName: string | null;
  status: string;
  reviewStatus: string | null;
  currentRevisionNumber: number | null;
  updatedAt: string;
};

export function ProjectCard({
  project,
  onArchive,
}: {
  project: ProjectCardData;
  onArchive?: (project: ProjectCardData) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{project.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {project.templateName ?? "Template not selected"}
        </p>
        <p className="text-sm text-muted-foreground">
          Updated {new Date(project.updatedAt).toLocaleDateString()}
          {project.currentRevisionNumber
            ? ` · Input revision ${project.currentRevisionNumber}`
            : " · No saved revision yet"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.reviewStatus ?? project.status} />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild className="min-h-11">
            <Link
              to="/tailor/projects/$projectId"
              params={{ projectId: project.id }}
              search={{ step: "overview" }}
            >
              Continue project
            </Link>
          </Button>
          {onArchive ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onArchive(project)}
            >
              {project.status === "archived" ? "Restore" : "Archive"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
