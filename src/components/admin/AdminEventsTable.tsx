import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { eventsApi, EventApiError } from "@/lib/events/client/api";
import {
  ADMIN_VIEWS,
  DEFAULT_ADMIN_SEARCH,
  ADMIN_VIEW_LABELS,
  CATEGORY_LABELS,
  EVENT_CATEGORIES,
  LIFECYCLE_LABELS,
  PUBLICATION_LABELS,
  REVIEW_LABELS,
  formatEventDate,
  type AdminEventDetail,
  type AdminEventRow,
  type AdminSortField,
  type AdminView,
} from "@/lib/events/contracts";

export type AdminEventSearch = {
  view: AdminView;
  q: string;
  category: string;
  city: string;
  sort: AdminSortField;
  dir: "asc" | "desc";
  page: number;
  peek: string;
};

function reviewTone(state: AdminEventRow["reviewState"]) {
  if (state === "submitted") return "review";
  if (state === "changes_requested") return "review";
  if (state === "rejected") return "stop";
  if (state === "approved") return "live";
  return "draft";
}

function publicationTone(state: AdminEventRow["publication"]) {
  if (state === "published") return "live";
  if (state === "suspended") return "stop";
  return "draft";
}

export function AdminEventsTable({ search }: { search: AdminEventSearch }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-events", search],
    queryFn: () =>
      eventsApi.adminEvents({
        view: search.view,
        q: search.q,
        category: search.category,
        city: search.city,
        sort: search.sort,
        dir: search.dir,
        page: search.page,
      }),
  });

  function setSearch(patch: Partial<AdminEventSearch>) {
    void navigate({
      to: "/admin/events",
      search: (prev) => ({
        ...DEFAULT_ADMIN_SEARCH,
        ...prev,
        ...patch,
        ...(patch.page === undefined && (patch.view || patch.q || patch.category || patch.city)
          ? { page: 1 }
          : {}),
      }),
    });
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <>
      <div className="admin-views" role="tablist" aria-label="Event views">
        {ADMIN_VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            className="admin-view-tab"
            data-active={search.view === view}
            aria-selected={search.view === view}
            onClick={() => setSearch({ view })}
          >
            {ADMIN_VIEW_LABELS[view]}
          </button>
        ))}
      </div>

      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="search"
          placeholder="Search events"
          defaultValue={search.q}
          aria-label="Search events"
          onKeyDown={(e) => {
            if (e.key === "Enter") setSearch({ q: e.currentTarget.value });
          }}
        />
        <select
          className="admin-search"
          value={search.category}
          aria-label="Filter by category"
          onChange={(e) => setSearch({ category: e.target.value })}
        >
          <option value="">Any category</option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          className="admin-search"
          type="search"
          placeholder="City"
          defaultValue={search.city}
          aria-label="Filter by city"
          onKeyDown={(e) => {
            if (e.key === "Enter") setSearch({ city: e.currentTarget.value });
          }}
        />
        <button
          type="button"
          className="admin-chip"
          data-on={search.sort === "updated_at"}
          onClick={() =>
            setSearch({ sort: "updated_at", dir: search.dir === "desc" ? "asc" : "desc" })
          }
        >
          Sort: last updated
        </button>
        <button
          type="button"
          className="admin-chip"
          data-on={search.sort === "starts_at"}
          onClick={() => setSearch({ sort: "starts_at", dir: "asc" })}
        >
          Sort: start date
        </button>
        <button
          type="button"
          className="admin-chip"
          onClick={() =>
            setSearch({ q: "", city: "", category: "", sort: "updated_at", dir: "desc" })
          }
        >
          Reset
        </button>
        <Link className="admin-chip" to="/admin/events" search={DEFAULT_ADMIN_SEARCH}>
          Full table
        </Link>
      </div>

      {list.isPending ? (
        <p className="admin-empty" role="status">
          Loading events…
        </p>
      ) : list.isError ? (
        <div className="admin-empty">
          <p>Events could not load.</p>
          <button className="admin-button mt-3" onClick={() => void list.refetch()}>
            Try again
          </button>
        </div>
      ) : list.data.items.length === 0 ? (
        <p className="admin-empty">
          {search.view === "needs_review"
            ? "Nothing is waiting for review."
            : "No events match this view."}
        </p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">
                    <button type="button" onClick={() => setSearch({ sort: "title", dir: "asc" })}>
                      Event
                    </button>
                  </th>
                  <th scope="col">Review</th>
                  <th scope="col">Publication</th>
                  <th scope="col">
                    <button
                      type="button"
                      onClick={() => setSearch({ sort: "starts_at", dir: "asc" })}
                    >
                      Start
                    </button>
                  </th>
                  <th scope="col">City</th>
                  <th scope="col">Organiser</th>
                  <th scope="col">Confirmed</th>
                  <th scope="col">
                    <button
                      type="button"
                      onClick={() =>
                        setSearch({
                          sort: "updated_at",
                          dir: search.dir === "desc" ? "asc" : "desc",
                        })
                      }
                    >
                      Updated
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((row) => (
                  <tr key={row.id} data-selected={search.peek === row.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-cell-title"
                        onClick={() => setSearch({ peek: row.id })}
                      >
                        <span className="admin-cell-title-mark" aria-hidden="true">
                          E
                        </span>
                        {row.title}
                      </button>
                      <div className="admin-cell-muted">{CATEGORY_LABELS[row.category]}</div>
                    </td>
                    <td>
                      <span className="admin-pill" data-tone={reviewTone(row.reviewState)}>
                        {REVIEW_LABELS[row.reviewState]}
                      </span>
                    </td>
                    <td>
                      <span className="admin-pill" data-tone={publicationTone(row.publication)}>
                        {PUBLICATION_LABELS[row.publication]}
                      </span>
                    </td>
                    <td className="admin-cell-muted">
                      {formatEventDate(row.startsAt, row.endsAt, row.timezone)}
                    </td>
                    <td className="admin-cell-muted">{row.city ?? "Online"}</td>
                    <td className="admin-cell-muted">{row.organizerName}</td>
                    <td className="admin-cell-muted">
                      {row.confirmedCount}
                      {row.capacity !== null ? ` / ${row.capacity}` : ""}
                      {row.waitlistCount > 0 ? ` (+${row.waitlistCount} waiting)` : ""}
                    </td>
                    <td className="admin-cell-muted">
                      {new Date(row.updatedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pager">
            <span>
              {list.data.total} event{list.data.total === 1 ? "" : "s"} · page {list.data.page} of{" "}
              {totalPages}
            </span>
            <button
              type="button"
              disabled={search.page <= 1}
              onClick={() => setSearch({ page: search.page - 1 })}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={search.page >= totalPages}
              onClick={() => setSearch({ page: search.page + 1 })}
            >
              Next
            </button>
          </div>
        </>
      )}

      {search.peek ? (
        <EventPeek
          eventId={search.peek}
          onClose={() => setSearch({ peek: "" })}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: ["admin-events"] });
            void queryClient.invalidateQueries({ queryKey: ["admin-counts"] });
          }}
        />
      ) : null}
    </>
  );
}

const PEEK_TABS = ["Details", "Registration", "Attendees", "Review history"] as const;

function EventPeek({
  eventId,
  onClose,
  onChanged,
}: {
  eventId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<(typeof PEEK_TABS)[number]>("Details");
  const detail = useQuery({
    queryKey: ["admin-event", eventId],
    queryFn: () => eventsApi.adminEvent(eventId),
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="admin-peek-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="admin-peek"
        role="dialog"
        aria-modal="true"
        aria-label={detail.data?.title ?? "Event details"}
      >
        <div className="admin-peek-head">
          <div>
            <h2>{detail.data?.title ?? "Event"}</h2>
            <p className="admin-page-sub">
              {detail.data
                ? `${CATEGORY_LABELS[detail.data.category]} · ${detail.data.organizerName}`
                : ""}
            </p>
          </div>
          <button type="button" className="admin-peek-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="admin-peek-tabs" role="tablist" aria-label="Event record sections">
          {PEEK_TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              data-active={tab === name}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="admin-peek-body">
          {detail.isPending ? (
            <p role="status">Loading the record…</p>
          ) : detail.isError || !detail.data ? (
            <div>
              <p>This record could not load.</p>
              <button className="admin-button mt-3" onClick={() => void detail.refetch()}>
                Try again
              </button>
            </div>
          ) : (
            <EventRecord
              detail={detail.data}
              tab={tab}
              onChanged={() => {
                void detail.refetch();
                onChanged();
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

function EventRecord({
  detail,
  tab,
  onChanged,
}: {
  detail: AdminEventDetail;
  tab: (typeof PEEK_TABS)[number];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(`${label} recorded.`);
      onChanged();
    } catch (e) {
      setError(e instanceof EventApiError ? e.failure.message : `${label} failed.`);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      {tab === "Details" ? (
        <>
          {detail.coverUrl ? (
            <img className="admin-preview-frame" src={detail.coverUrl} alt="" />
          ) : (
            <div className="admin-note">No cover uploaded.</div>
          )}
          <dl className="admin-props mt-4">
            <div className="admin-prop">
              <dt>Review</dt>
              <dd>
                <span className="admin-pill" data-tone={reviewTone(detail.reviewState)}>
                  {REVIEW_LABELS[detail.reviewState]}
                </span>
              </dd>
            </div>
            <div className="admin-prop">
              <dt>Publication</dt>
              <dd>
                <span className="admin-pill" data-tone={publicationTone(detail.publication)}>
                  {PUBLICATION_LABELS[detail.publication]}
                </span>
              </dd>
            </div>
            <div className="admin-prop">
              <dt>Lifecycle</dt>
              <dd>{LIFECYCLE_LABELS[detail.lifecycle]}</dd>
            </div>
            <div className="admin-prop">
              <dt>Schedule</dt>
              <dd>
                {formatEventDate(detail.startsAt, detail.endsAt, detail.timezone)} ·{" "}
                {detail.timezone}
              </dd>
            </div>
            <div className="admin-prop">
              <dt>Location</dt>
              <dd>
                {[detail.venue, detail.city, detail.country].filter(Boolean).join(", ") || "Online"}
              </dd>
            </div>
            <div className="admin-prop">
              <dt>Revision</dt>
              <dd>
                {detail.revisionNo} (live {detail.approvedRevisionNo})
              </dd>
            </div>
            <div className="admin-prop">
              <dt>Organiser</dt>
              <dd>
                {detail.organizers[0]?.name} · {detail.organizers[0]?.contactEmail}
              </dd>
            </div>
            {detail.onlineUrlPrivate ? (
              <div className="admin-prop">
                <dt>Private link</dt>
                <dd>{detail.onlineUrlPrivate}</dd>
              </div>
            ) : null}
          </dl>
          <div className="admin-section">
            <h3>Description</h3>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{detail.description}</p>
          </div>
          {detail.reviewState === "submitted" ? (
            <ReviewActions
              detail={detail}
              busy={busy}
              onAction={act}
              internalNote={internalNote}
              setInternalNote={setInternalNote}
            />
          ) : null}
          <div className="admin-section">
            <h3>Actions</h3>
            <div className="admin-actions-grid">
              <button
                className="admin-button"
                disabled={busy !== ""}
                onClick={() => act("Feature", () => eventsApi.adminFeature(detail.id, true))}
              >
                Feature for 30 days
              </button>
              <button
                className="admin-button"
                disabled={busy !== ""}
                onClick={() => act("Unfeature", () => eventsApi.adminFeature(detail.id, false))}
              >
                Remove feature
              </button>
              {detail.publication === "suspended" ? (
                <button
                  className="admin-button"
                  disabled={busy !== ""}
                  onClick={() =>
                    act("Republish", () =>
                      eventsApi.adminPublication(detail.id, { action: "republish", reason: "" }),
                    )
                  }
                >
                  Republish
                </button>
              ) : (
                <button
                  className="admin-button"
                  disabled={busy !== "" || detail.publication !== "published"}
                  onClick={() =>
                    act("Suspend", () =>
                      eventsApi.adminPublication(detail.id, {
                        action: "suspend",
                        reason: "Suspended by Fashley staff.",
                      }),
                    )
                  }
                >
                  Suspend listing
                </button>
              )}
              <button
                className="admin-button"
                data-variant="danger"
                disabled={busy !== "" || detail.lifecycle === "cancelled"}
                onClick={() =>
                  act("Cancel event", () =>
                    eventsApi.adminPublication(detail.id, {
                      action: "cancel",
                      reason: "Cancelled by Fashley staff.",
                    }),
                  )
                }
              >
                Cancel event
              </button>
              <button
                className="admin-button"
                disabled={busy !== ""}
                onClick={() =>
                  act("Postpone", () =>
                    eventsApi.adminPublication(detail.id, {
                      action: "postpone",
                      reason: "Postponed pending a new date.",
                    }),
                  )
                }
              >
                Postpone
              </button>
              {detail.publication === "published" ? (
                <Link
                  className="admin-button"
                  to="/events/$slug"
                  params={{ slug: detail.slug }}
                  target="_blank"
                >
                  Open public page
                </Link>
              ) : null}
            </div>
            {message ? <p className="admin-page-sub">{message}</p> : null}
            {error ? <p className="admin-error">{error}</p> : null}
          </div>
        </>
      ) : null}

      {tab === "Registration" ? (
        <dl className="admin-props">
          <div className="admin-prop">
            <dt>Confirmed</dt>
            <dd>
              {detail.confirmedCount}
              {detail.capacity !== null ? ` of ${detail.capacity}` : " (no limit)"}
            </dd>
          </div>
          <div className="admin-prop">
            <dt>Waitlisted</dt>
            <dd>{detail.waitlistCount}</dd>
          </div>
          <div className="admin-prop">
            <dt>Waitlist</dt>
            <dd>{detail.waitlistEnabled ? "Enabled" : "Disabled"}</dd>
          </div>
          <div className="admin-prop">
            <dt>Registration</dt>
            <dd>{detail.registrationClosed ? "Closed" : "Open"}</dd>
          </div>
          <div className="admin-prop">
            <dt>Opens</dt>
            <dd>{detail.registrationOpensAt ?? "Immediately after publication"}</dd>
          </div>
          <div className="admin-prop">
            <dt>Closes</dt>
            <dd>{detail.registrationClosesAt ?? "When the event ends"}</dd>
          </div>
          <div className="admin-prop">
            <dt>Safe capacity</dt>
            <dd>
              Lowering capacity below confirmed attendance is rejected by the database guard, so a
              revision cannot orphan a confirmed seat.
            </dd>
          </div>
        </dl>
      ) : null}

      {tab === "Attendees" ? (
        <div className="admin-note">
          Attendee names, emails and answers stay in the organiser workspace. Staff review listings
          and reports; browsing attendee lists is a separate permission that this screen does not
          grant. Counts are on the Registration tab.
        </div>
      ) : null}

      {tab === "Review history" ? (
        detail.reviews.length === 0 ? (
          <p className="admin-note">No reviews recorded yet.</p>
        ) : (
          <div className="admin-list">
            {detail.reviews.map((review) => (
              <div key={review.id} className="admin-list-row">
                <div>
                  <strong>{review.decision.replace("_", " ")}</strong>
                  <div className="admin-cell-muted">
                    Revision {review.revisionNo} · {review.reviewerName} ·{" "}
                    {new Date(review.createdAt).toLocaleString("en-GB")}
                  </div>
                  {review.organizerMessage ? (
                    <div className="admin-cell-muted">To organiser: {review.organizerMessage}</div>
                  ) : null}
                  {review.internalNote ? (
                    <div className="admin-cell-muted">Internal: {review.internalNote}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </>
  );
}

function ReviewActions({
  detail,
  busy,
  onAction,
  internalNote,
  setInternalNote,
}: {
  detail: AdminEventDetail;
  busy: string;
  onAction: (label: string, fn: () => Promise<unknown>) => Promise<void>;
  internalNote: string;
  setInternalNote: (value: string) => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <div className="admin-section">
      <h3>Review this revision</h3>
      <div className="admin-field">
        <span>Message to organiser</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1200}
          placeholder="Required when asking for changes or rejecting."
        />
      </div>
      <div className="admin-field">
        <span>Internal note (never shown to the organiser)</span>
        <textarea
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
          maxLength={1200}
        />
      </div>
      <div className="admin-actions-grid">
        <button
          className="admin-button"
          data-variant="primary"
          disabled={busy !== ""}
          onClick={() =>
            onAction("Publish", () =>
              eventsApi.adminReview(detail.id, {
                revisionId: detail.revisionId!,
                decision: "approved",
                organizerMessage: message,
                internalNote,
              }),
            )
          }
        >
          Approve and publish
        </button>
        <button
          className="admin-button"
          disabled={busy !== "" || message.trim().length < 5}
          onClick={() =>
            onAction("Request changes", () =>
              eventsApi.adminReview(detail.id, {
                revisionId: detail.revisionId!,
                decision: "changes_requested",
                organizerMessage: message,
                internalNote,
              }),
            )
          }
        >
          Request changes
        </button>
        <button
          className="admin-button"
          data-variant="danger"
          disabled={busy !== "" || message.trim().length < 5}
          onClick={() =>
            onAction("Reject", () =>
              eventsApi.adminReview(detail.id, {
                revisionId: detail.revisionId!,
                decision: "rejected",
                organizerMessage: message,
                internalNote,
              }),
            )
          }
        >
          Reject
        </button>
      </div>
    </div>
  );
}
