import { AVAILABILITY_COPY, type RegistrationAvailability } from "@/lib/events/contracts";

const TONE: Partial<Record<RegistrationAvailability, "open" | "closed">> = {
  open: "open",
  waitlist: "open",
  closed: "closed",
  full: "closed",
  cancelled: "closed",
  postponed: "closed",
  ended: "closed",
};

export function AvailabilityTag({ availability }: { availability: RegistrationAvailability }) {
  const tone = TONE[availability];
  return (
    <span className="ev-tag" data-tone={tone}>
      {AVAILABILITY_COPY[availability]}
    </span>
  );
}
