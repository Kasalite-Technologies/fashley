import type {
  AdminEventDetail,
  AdminEventRow,
  AdminListQuery,
  AttendeeRow,
  EventDetail,
  EventEditorDraft,
  EventCard,
  OrganizerEventSummary,
  OrganizerProfile,
  OwnRegistration,
  Paginated,
  RegistrationInput,
} from "../contracts";

export interface ApiFailure {
  code: string;
  message: string;
  retryable: boolean;
  fieldErrors?: Record<string, string[]>;
}

export class EventApiError extends Error {
  constructor(
    public failure: ApiFailure,
    public status: number,
  ) {
    super(failure.message);
    this.name = "EventApiError";
  }
}

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;
export function setEventTokenProvider(getter: TokenGetter | null) {
  tokenGetter = getter;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!tokenGetter) return {};
  try {
    const token = await tokenGetter();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(await authHeaders()),
    ...init.headers,
  };
  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    error?: ApiFailure;
  } | null;
  if (!response.ok || !payload || payload.error) {
    throw new EventApiError(
      payload?.error ?? {
        code: "UNEXPECTED",
        message: "That request could not be completed.",
        retryable: true,
      },
      response.status,
    );
  }
  return payload.data as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const eventsApi = {
  directory: (params: Record<string, string | number | undefined>) =>
    call<Paginated<EventCard>>(`/api/events${qs(params)}`),
  cities: () => call<{ items: string[] }>("/api/events/cities"),
  event: (slug: string) => call<EventDetail>(`/api/events/${encodeURIComponent(slug)}`),
  organizer: (slug: string) =>
    call<OrganizerProfile>(`/api/organizers/${encodeURIComponent(slug)}`),
  report: (slug: string, body: { reason: string; detail: string; reporterEmail: string }) =>
    call<{ ok: boolean }>(`/api/events/${encodeURIComponent(slug)}/reports`, {
      method: "POST",
      body,
    }),
  register: (slug: string, body: RegistrationInput) =>
    call<OwnRegistration>(`/api/events/${encodeURIComponent(slug)}/register`, {
      method: "POST",
      body,
      headers: { "Idempotency-Key": crypto.randomUUID() },
    }),
  joinWaitlist: (slug: string, body: RegistrationInput) =>
    call<OwnRegistration>(`/api/events/${encodeURIComponent(slug)}/waitlist`, {
      method: "POST",
      body,
    }),
  myRegistrations: () => call<{ items: OwnRegistration[] }>("/api/events/me/registrations"),
  myRegistration: (id: string) => call<OwnRegistration>(`/api/events/me/registrations/${id}`),
  ticket: (id: string) =>
    call<{ credential: string; checkedInAt: string | null }>(
      `/api/events/me/registrations/${id}/ticket`,
    ),
  cancelRegistration: (id: string) =>
    call<{ ok: boolean }>(`/api/events/me/registrations/${id}`, { method: "DELETE" }),

  myOrganizer: () =>
    call<{
      id: string;
      slug: string;
      name: string;
      bio: string;
      city: string | null;
      country: string | null;
      website: string | null;
      contactEmail: string;
      status: string;
    } | null>("/api/organizer/profile"),
  saveOrganizer: (body: {
    name: string;
    bio: string;
    city: string;
    country: string;
    website: string;
    contactEmail: string;
  }) => call<unknown>("/api/organizer/profile", { method: "PUT", body }),
  myEvents: () =>
    call<{
      items: OrganizerEventSummary[];
      organizer: {
        id: string;
        slug: string;
        name: string;
        bio: string;
        city: string | null;
        country: string | null;
        website: string | null;
        contactEmail: string;
        status: string;
      } | null;
    }>("/api/organizer/events"),
  createEvent: (body: unknown) =>
    call<EventEditorDraft>("/api/organizer/events", { method: "POST", body }),
  myEvent: (id: string) => call<EventEditorDraft>(`/api/organizer/events/${id}`),
  saveEvent: (id: string, body: unknown) =>
    call<EventEditorDraft>(`/api/organizer/events/${id}`, { method: "PUT", body }),
  submitEvent: (id: string) =>
    call<EventEditorDraft>(`/api/organizer/events/${id}/submit`, { method: "POST", body: {} }),
  withdrawEvent: (id: string) =>
    call<EventEditorDraft>(`/api/organizer/events/${id}/withdraw`, { method: "POST", body: {} }),
  setRegistrationClosed: (id: string, closed: boolean, reason = "") =>
    call<{ ok: boolean }>(`/api/organizer/events/${id}/registration`, {
      method: "POST",
      body: { action: closed ? "close_registration" : "reopen_registration", reason },
    }),
  cancelEvent: (id: string, reason: string) =>
    call<{ ok: boolean }>(`/api/organizer/events/${id}/registration`, {
      method: "POST",
      body: { action: "cancel", reason },
    }),
  attendees: (id: string) =>
    call<{ items: AttendeeRow[] }>(`/api/organizer/events/${id}/attendees`),
  promote: (id: string, registrationId: string) =>
    call<{ ok: boolean }>(`/api/organizer/events/${id}/attendees/${registrationId}/promote`, {
      method: "POST",
      body: {},
    }),
  checkIn: (id: string, credential: string) =>
    call<{ state: "checked_in" | "already_checked_in"; checkedInAt: string; displayName: string }>(
      `/api/organizer/events/${id}/check-in`,
      { method: "POST", body: { credential } },
    ),
  uploadCover: async (id: string, file: File) => {
    const headers = await authHeaders();
    const response = await fetch(`/api/organizer/events/${id}/cover`, {
      method: "POST",
      headers: { ...headers, "Content-Type": file.type },
      body: file,
    });
    const payload = (await response.json().catch(() => null)) as {
      data?: { coverUrl: string };
      error?: ApiFailure;
    } | null;
    if (!response.ok || payload?.error)
      throw new EventApiError(
        payload?.error ?? { code: "UNEXPECTED", message: "Upload failed.", retryable: true },
        response.status,
      );
    return payload?.data as { coverUrl: string };
  },

  adminSession: () =>
    call<{
      userId: string;
      role: "events_editor" | "platform_admin" | null;
      canManageStaff: boolean;
    }>("/api/admin/session"),
  adminCounts: () =>
    call<{
      needsReview: number;
      changesRequested: number;
      published: number;
      suspended: number;
      openReports: number;
    }>("/api/admin/counts"),
  adminEvents: (params: Partial<AdminListQuery>) =>
    call<Paginated<AdminEventRow>>(
      `/api/admin/events${qs(params as Record<string, string | number | undefined>)}`,
    ),
  adminEvent: (id: string) => call<AdminEventDetail>(`/api/admin/events/${id}`),
  adminReview: (
    id: string,
    body: {
      revisionId: string;
      decision: "approved" | "changes_requested" | "rejected";
      organizerMessage: string;
      internalNote: string;
    },
  ) => call<AdminEventDetail>(`/api/admin/events/${id}/review`, { method: "POST", body }),
  adminPublication: (
    id: string,
    body: { action: "suspend" | "republish" | "archive" | "cancel" | "postpone"; reason: string },
  ) => call<AdminEventDetail>(`/api/admin/events/${id}/publication`, { method: "POST", body }),
  adminFeature: (id: string, featured: boolean) =>
    call<{ ok: boolean }>(`/api/admin/events/${id}/feature`, {
      method: "POST",
      body: { featured },
    }),
  adminOrganizers: () =>
    call<{
      items: {
        id: string;
        slug: string;
        name: string;
        bio: string;
        contactEmail: string;
        ownerEmail: string | null;
        city: string | null;
        country: string | null;
        status: string;
        eventCount: number;
        publishedCount: number;
        createdAt: string;
      }[];
    }>("/api/admin/organizers"),
  adminOrganizerStatus: (id: string, status: "active" | "suspended") =>
    call<{ ok: boolean }>(`/api/admin/organizers/${id}/status`, {
      method: "POST",
      body: { status },
    }),
  adminReports: () =>
    call<{
      items: {
        id: string;
        eventId: string;
        eventTitle: string;
        eventSlug: string;
        reason: string;
        detail: string;
        status: string;
        resolutionNote: string;
        createdAt: string;
      }[];
    }>("/api/admin/reports"),
  adminResolveReport: (id: string, resolution: "resolved" | "dismissed", note: string) =>
    call<{ ok: boolean }>(`/api/admin/reports/${id}/resolve`, {
      method: "POST",
      body: { resolution, note },
    }),
  adminActivity: () =>
    call<{
      items: {
        id: string;
        action: string;
        resourceType: string;
        resourceId: string;
        summary: Record<string, unknown>;
        actorEmail: string | null;
        createdAt: string;
      }[];
    }>("/api/admin/activity"),
  adminStaff: () =>
    call<{
      items: {
        id: string;
        userId: string;
        role: string;
        email: string | null;
        grantedAt: string;
      }[];
    }>("/api/admin/staff"),
  adminGrantStaff: (email: string, role: "events_editor" | "platform_admin") =>
    call<{ id: string }>("/api/admin/staff", { method: "POST", body: { email, role } }),
  adminRevokeStaff: (grantId: string) =>
    call<{ ok: boolean }>(`/api/admin/staff/${grantId}`, { method: "DELETE" }),
  dispatchNotifications: () =>
    call<{ sent: number; failed: number }>("/api/admin/notifications/dispatch", {
      method: "POST",
      body: {},
    }),
};
