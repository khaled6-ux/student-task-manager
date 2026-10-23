// Calendar grouping uses the profile's IANA timezone; instants stay ISO/UTC in the API.
export function dayKey(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function localInput(instant: string | null): string {
  if (!instant) return "";
  const date = new Date(instant);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function instantFromLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  // Reject invalid or nonexistent local times (for example, a DST spring-forward gap).
  if (
    !Number.isFinite(date.getTime()) ||
    localInput(date.toISOString()) !== value
  )
    throw new Error("Choose a valid local date and time.");
  return date.toISOString();
}
