import { z } from "zod";

/**
 * Shared, browser-safe event vocabulary and request schemas. Validation that
 * needs the database (capacity, lifecycle, permissions) lives server-side.
 */

export const EVENT_CATEGORIES = [
  "fashion-show",
  "fashion-week",
  "pop-up",
  "exhibition",
  "workshop",
  "talk",
  "fabric-market",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  "fashion-show": "Runway show",
  "fashion-week": "Fashion week",
  "pop-up": "Pop-up or market",
  exhibition: "Exhibition or trade fair",
  workshop: "Workshop or class",
  talk: "Talk or networking",
  "fabric-market": "Fabric or textile event",
};

export const EVENT_FORMATS = ["in_person", "online", "hybrid"] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number];

export const FORMAT_LABELS: Record<EventFormat, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "In person and online",
};

export const REVIEW_STATES = [
  "draft",
  "submitted",
  "changes_requested",
  "approved",
  "rejected",
  "withdrawn",
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const REVIEW_LABELS: Record<ReviewState, string> = {
  draft: "Draft",
  submitted: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const PUBLICATION_STATES = ["unpublished", "published", "suspended", "archived"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export const PUBLICATION_LABELS: Record<PublicationState, string> = {
  unpublished: "Not listed",
  published: "Published",
  suspended: "Suspended",
  archived: "Archived",
};

export const LIFECYCLE_STATES = ["scheduled", "postponed", "cancelled"] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  scheduled: "Scheduled",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

export const REGISTRATION_STATES = ["confirmed", "waitlisted", "cancelled"] as const;
export type RegistrationState = (typeof REGISTRATION_STATES)[number];

/** What the attendee sees on the event page. Derived, never stored. */
export type RegistrationAvailability =
  | "open"
  | "waitlist"
  | "full"
  | "closed"
  | "not_open"
  | "ended"
  | "cancelled"
  | "postponed"
  | "unlisted";

export const AVAILABILITY_COPY: Record<RegistrationAvailability, string> = {
  open: "Registration open",
  waitlist: "Waitlist open",
  full: "Event full",
  closed: "Registration closed",
  not_open: "Registration opens later",
  ended: "Event ended",
  cancelled: "Event cancelled",
  postponed: "Postponed",
  unlisted: "Not listed",
};

export const REPORT_REASONS = [
  "misleading",
  "duplicate",
  "inappropriate",
  "wrong_details",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  misleading: "Misleading information",
  duplicate: "Duplicate listing",
  inappropriate: "Inappropriate content",
  wrong_details: "Wrong date or location",
  other: "Something else",
};

export const ADMIN_VIEWS = [
  "all",
  "needs_review",
  "changes_requested",
  "published",
  "upcoming",
  "past",
] as const;
export type AdminView = (typeof ADMIN_VIEWS)[number];

export const ADMIN_VIEW_LABELS: Record<AdminView, string> = {
  all: "All events",
  needs_review: "Needs review",
  changes_requested: "Changes requested",
  published: "Published",
  upcoming: "Upcoming",
  past: "Past and cancelled",
};

export const ADMIN_SORT_FIELDS = ["starts_at", "updated_at", "submitted_at", "title"] as const;
export type AdminSortField = (typeof ADMIN_SORT_FIELDS)[number];

export interface AdminListQuery {
  view: AdminView;
  q: string;
  category: string;
  city: string;
  format: string;
  sort: AdminSortField;
  dir: "asc" | "desc";
  page: number;
}

/** Defaults so links can reach a filtered page without repeating every field. */
export const DEFAULT_DIRECTORY_SEARCH = {
  q: "",
  city: "",
  category: "",
  format: "",
  when: "upcoming" as const,
  page: 1,
};

export const DEFAULT_ADMIN_SEARCH: AdminListQuery & { peek: string } = {
  view: "all",
  q: "",
  category: "",
  city: "",
  format: "",
  sort: "updated_at",
  dir: "desc",
  page: 1,
  peek: "",
};

// ---- Public DTOs ----

export interface EventCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: EventCategory;
  format: EventFormat;
  city: string | null;
  country: string | null;
  timezone: string;
  startsAt: string;
  endsAt: string;
  organizerName: string;
  organizerSlug: string;
  coverUrl: string | null;
  availability: RegistrationAvailability;
}

export interface EventDetail extends EventCard {
  description: string;
  venue: string | null;
  accessibility: string;
  accessInfo: string | null;
  ageLimit: number | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  capacity: number | null;
  remaining: number | null;
  waitlistEnabled: boolean;
  lifecycle: LifecycleState;
  updatedAt: string;
}

export interface OrganizerProfile {
  slug: string;
  name: string;
  bio: string;
  city: string | null;
  country: string | null;
  website: string | null;
  events: EventCard[];
}

export interface OwnRegistration {
  id: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventStartsAt: string;
  eventEndsAt: string;
  eventTimezone: string;
  eventCity: string | null;
  eventFormat: EventFormat;
  eventLifecycle: LifecycleState;
  eventPublication: PublicationState;
  state: RegistrationState;
  registeredAt: string;
  checkedInAt: string | null;
  accessInfo: string | null;
  onlineUrl: string | null;
}

export interface OrganizerEventSummary {
  id: string;
  slug: string;
  title: string;
  reviewState: ReviewState;
  publication: PublicationState;
  lifecycle: LifecycleState;
  startsAt: string;
  endsAt: string;
  timezone: string;
  city: string | null;
  format: EventFormat;
  confirmedCount: number;
  waitlistedCount: number;
  capacity: number | null;
  registrationClosed: boolean;
  updatedAt: string;
  submittedAt: string | null;
  organizerMessage: string | null;
}

export interface EventEditorDraft {
  id: string;
  slug: string;
  reviewState: ReviewState;
  publication: PublicationState;
  lifecycle: LifecycleState;
  revisionId: string;
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  format: EventFormat;
  city: string;
  country: string;
  venue: string;
  onlineUrl: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  capacity: string;
  waitlistEnabled: boolean;
  accessInfo: string;
  accessibility: string;
  ageLimit: string;
  coverUrl: string | null;
  canEdit: boolean;
  organizerMessage: string | null;
  organizerSlug: string;
  organizerName: string;
  registrationClosed: boolean;
  confirmedCount: number;
  waitlistedCount: number;
  checkedInCount: number;
}

export interface AdminEventRow {
  id: string;
  slug: string;
  title: string;
  reviewState: ReviewState;
  publication: PublicationState;
  lifecycle: LifecycleState;
  startsAt: string;
  endsAt: string;
  timezone: string;
  city: string | null;
  format: EventFormat;
  category: EventCategory;
  organizerId: string;
  organizerName: string;
  confirmedCount: number;
  capacity: number | null;
  waitlistCount: number;
  submittedAt: string | null;
  updatedAt: string;
}

export interface AdminEventDetail extends AdminEventRow {
  summary: string;
  description: string;
  venue: string | null;
  country: string | null;
  onlineUrlPrivate: string | null;
  accessibility: string;
  ageLimit: number | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationClosed: boolean;
  waitlistEnabled: boolean;
  coverUrl: string | null;
  revisionId: string | null;
  revisionNo: number;
  approvedRevisionNo: number;
  organizers: { id: string; name: string; slug: string; contactEmail: string; status: string }[];
  reviews: {
    id: string;
    decision: string;
    revisionNo: number;
    organizerMessage: string;
    internalNote: string;
    reviewerName: string;
    createdAt: string;
  }[];
}

export interface AttendeeRow {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  state: RegistrationState;
  registeredAt: string;
  checkedInAt: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- Request schemas ----

const trimmed = (max: number) => z.string().trim().max(max);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Use an http or https link.");

export const organizerProfileInputSchema = z
  .object({
    name: trimmed(120).min(2, "Enter the organiser name."),
    bio: trimmed(1200).default(""),
    city: trimmed(80).default(""),
    country: trimmed(80).default(""),
    website: optionalUrl.default(""),
    contactEmail: z.string().trim().email().max(200),
  })
  .strict();

export const draftEventInputSchema = z
  .object({
    title: trimmed(140).min(3, "Enter an event title."),
    summary: trimmed(240).default(""),
    description: trimmed(4000).default(""),
    category: z.enum(EVENT_CATEGORIES),
    format: z.enum(EVENT_FORMATS),
    city: trimmed(80).default(""),
    country: trimmed(80).default(""),
    venue: trimmed(200).default(""),
    onlineUrl: optionalUrl.default(""),
    timezone: trimmed(64).min(1).default("Africa/Accra"),
    startsAt: z.string().trim().min(1, "Choose a start date."),
    endsAt: z.string().trim().min(1, "Choose an end date."),
    registrationOpensAt: z.string().trim().max(40).default(""),
    registrationClosesAt: z.string().trim().max(40).default(""),
    capacity: z.string().trim().max(10).default(""),
    waitlistEnabled: z.boolean().default(false),
    accessInfo: trimmed(1200).default(""),
    accessibility: trimmed(800).default(""),
    ageLimit: z.string().trim().max(3).default(""),
  })
  .strict();
export type DraftEventInput = z.infer<typeof draftEventInputSchema>;

export const submitEventInputSchema = z
  .object({
    rightsConfirmed: z.literal(true),
  })
  .strict();

export const registrationInputSchema = z
  .object({
    displayName: trimmed(120).min(2, "Enter your name."),
    email: z.string().trim().email().max(200),
    phone: trimmed(40).default(""),
    accessibilityRequest: trimmed(500).default(""),
  })
  .strict();
export type RegistrationInput = z.infer<typeof registrationInputSchema>;

export const reviewDecisionSchema = z
  .object({
    revisionId: z.string().min(1).max(128),
    decision: z.enum(["approved", "changes_requested", "rejected"]),
    organizerMessage: trimmed(1200).default(""),
    internalNote: trimmed(1200).default(""),
  })
  .strict()
  .refine(
    (v) => v.decision === "approved" || v.organizerMessage.length >= 5,
    "Tell the organiser what needs to change.",
  );

export const eventLifecycleActionSchema = z
  .object({
    action: z.enum([
      "close_registration",
      "reopen_registration",
      "cancel",
      "postpone",
      "archive",
      "suspend",
      "republish",
    ]),
    reason: trimmed(500).default(""),
  })
  .strict();

export const reportInputSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    detail: trimmed(1000).default(""),
    reporterEmail: z.union([z.literal(""), z.string().trim().email().max(200)]).default(""),
  })
  .strict();

export const checkInInputSchema = z
  .object({
    credential: z.string().trim().min(10).max(200),
  })
  .strict();

export const directoryQuerySchema = z.object({
  q: trimmed(120).default(""),
  city: trimmed(80).default(""),
  category: z.union([z.enum(EVENT_CATEGORIES), z.literal("")]).default(""),
  format: z.union([z.enum(EVENT_FORMATS), z.literal("")]).default(""),
  when: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  page: z.coerce.number().int().min(1).max(200).default(1),
});

export const adminListQuerySchema = z.object({
  view: z.enum(ADMIN_VIEWS).default("all"),
  q: trimmed(120).default(""),
  category: z.union([z.enum(EVENT_CATEGORIES), z.literal("")]).default(""),
  city: trimmed(80).default(""),
  format: z.union([z.enum(EVENT_FORMATS), z.literal("")]).default(""),
  sort: z.enum(ADMIN_SORT_FIELDS).default("updated_at"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(200).default(1),
});

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "event";

export function formatEventDate(startsAt: string, endsAt: string, timezone: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const sameDay = dateFmt.format(start) === dateFmt.format(end);
  const times = `${timeFmt.format(start)} to ${timeFmt.format(end)}`;
  return sameDay
    ? `${dateFmt.format(start)}, ${times}`
    : `${dateFmt.format(start)} to ${dateFmt.format(end)}`;
}
