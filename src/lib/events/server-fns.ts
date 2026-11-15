import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveEventsHttpDeps } from "./server/http";
import {
  listDirectory,
  getPublicEvent,
  getOrganizerProfile,
  listCities,
  featuredEvents,
} from "./server/events";
import { err } from "@/lib/tailor/server/errors";
import {
  directoryQuerySchema,
  type EventCard,
  type EventDetail,
  type OrganizerProfile,
  type Paginated,
} from "./contracts";

/**
 * Server functions for public reads. These run directly during SSR so the
 * directory and event pages render real content and metadata; the client
 * calls the same functions through the compiled fetcher.
 */

function db() {
  const deps = resolveEventsHttpDeps();
  if (!deps.db) throw err("FEATURE_UNAVAILABLE", "Events are not configured on this deployment.");
  return deps.db;
}

export const loadDirectory = createServerFn({ method: "GET" })
  .validator((input: unknown) => directoryQuerySchema.parse(input ?? {}))
  .handler(
    async ({
      data,
    }): Promise<{ events: Paginated<EventCard>; cities: string[]; featured: EventCard[] }> => {
      const database = db();
      return {
        events: await listDirectory(database, data),
        cities: await listCities(database),
        featured:
          data.page === 1 && data.when === "upcoming" && !data.q && !data.city
            ? await featuredEvents(database)
            : [],
      };
    },
  );

export const loadEvent = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }): Promise<EventDetail | null> => getPublicEvent(db(), data.slug));

export const loadOrganizer = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }): Promise<OrganizerProfile | null> =>
    getOrganizerProfile(db(), data.slug),
  );
