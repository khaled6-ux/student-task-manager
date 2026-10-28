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
// Explicit Gregorian/Latin wall fields; never use the browser's implicit zone.
function formatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    era: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
function wallFields(format: Intl.DateTimeFormat, instant: number) {
  const fields = Object.fromEntries(
    format.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const year =
    fields.era === "BC" ? 1 - Number(fields.year) : Number(fields.year);
  const isoYear =
    year >= 0 && year <= 9999
      ? String(year).padStart(4, "0")
      : `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(6, "0")}`;
  return `${isoYear}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:${fields.second}`;
}
export function localInput(instant: string | null, timeZone: string): string {
  if (!instant) return "";
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(instant))
    throw new Error("Choose a valid local date and time.");
  return wallFields(formatter(timeZone), Date.parse(instant)).slice(0, -3);
}
export function instantFromLocal(
  value: string,
  timeZone: string,
): string | null {
  if (!value) return null;
  const invalid = () => new Error("Choose a valid local date and time.");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    value.startsWith("0000")
  )
    throw invalid();
  // UTC reference for the wall fields, not the resulting instant.
  const wall = Date.parse(`${value}:00Z`);
  if (
    !Number.isFinite(wall) ||
    new Date(wall).toISOString().slice(0, 16) !== value
  )
    throw invalid();
  const format = formatter(timeZone);
  const offsets = new Set<number>();
  // Probe both sides of nearby transitions (also half-hour and skipped-day changes).
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = wall + hours * 3600000;
    offsets.add(Date.parse(`${wallFields(format, sample)}Z`) - sample);
  }
  const candidates = [...offsets]
    .map((offset) => wall - offset)
    .filter((instant) => wallFields(format, instant) === `${value}:00`);
  if (!candidates.length) throw invalid(); // Gap: do not silently shift the deadline.
  // Fall-back ambiguity: choose earlier. Unchanged edits preserve the exact original.
  return new Date(Math.min(...candidates)).toISOString();
}
