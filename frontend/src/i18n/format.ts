import type { SupportedLocale } from "./locales";

// A civil calendar day is already grouped in the profile timezone. Formatting it in
// UTC avoids shifting it again through the browser timezone (including DST).
export function formatCalendarDate(
  locale: SupportedLocale,
  day: string,
  dateStyle: "full" | "long" = "long",
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle,
    calendar: "gregory",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
export function weekdays(locale: SupportedLocale): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
    calendar: "gregory",
  });
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(Date.UTC(2023, 0, 1 + index))),
  );
}
