import type { DraftEventInput, EventEditorDraft } from "@/lib/events/contracts";

export interface OrganizerSummary {
  id: string;
  slug: string;
  name: string;
  bio: string;
  city: string | null;
  country: string | null;
  website: string | null;
  contactEmail: string;
  status: string;
}

/** Empty draft, pre-filled from what the organiser profile already knows. */
export function blankDraft(organizer: OrganizerSummary): DraftEventInput {
  return {
    title: "",
    summary: "",
    description: "",
    category: "fashion-show",
    format: "in_person",
    city: organizer.city ?? "",
    country: organizer.country ?? "",
    venue: "",
    onlineUrl: "",
    timezone: "Africa/Accra",
    startsAt: "",
    endsAt: "",
    registrationOpensAt: "",
    registrationClosesAt: "",
    capacity: "",
    waitlistEnabled: false,
    accessInfo: "",
    accessibility: "",
    ageLimit: "",
  };
}

export function draftToInput(draft: EventEditorDraft): DraftEventInput {
  return {
    title: draft.title,
    summary: draft.summary,
    description: draft.description,
    category: draft.category,
    format: draft.format,
    city: draft.city,
    country: draft.country,
    venue: draft.venue,
    onlineUrl: draft.onlineUrl,
    timezone: draft.timezone,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    registrationOpensAt: draft.registrationOpensAt,
    registrationClosesAt: draft.registrationClosesAt,
    capacity: draft.capacity,
    waitlistEnabled: draft.waitlistEnabled,
    accessInfo: draft.accessInfo,
    accessibility: draft.accessibility,
    ageLimit: draft.ageLimit,
  };
}
