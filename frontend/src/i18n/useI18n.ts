import { useLayoutEffect, useSyncExternalStore } from "react";
import { errorMessage, formatTaskCount, translate } from "./catalog";
import type { MessageKey } from "./catalog";
import { isLocale, localeMetadata, localeStorageKey } from "./locales";
import type { SupportedLocale } from "./locales";
const eventName = "student-task-manager:locale";
let storageUnavailable = false;
let memoryLocale: SupportedLocale = "en";
function snapshot(): SupportedLocale {
  if (storageUnavailable) return memoryLocale;
  try {
    const saved = localStorage.getItem(localeStorageKey);
    return isLocale(saved) ? saved : "en";
  } catch {
    return memoryLocale;
  }
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (!event.key || event.key === localeStorageKey) notify();
  };
  window.addEventListener(eventName, notify);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(eventName, notify);
    window.removeEventListener("storage", storage);
  };
}
export function setLocale(locale: SupportedLocale) {
  memoryLocale = locale;
  try {
    localStorage.setItem(localeStorageKey, locale);
    storageUnavailable = false;
  } catch {
    storageUnavailable = true;
    /* Private/restricted storage: keep selection for this page. */
  }
  window.dispatchEvent(new Event(eventName));
}
export function useI18n() {
  const locale = useSyncExternalStore(subscribe, snapshot, () => "en" as const);
  const { dir } = localeMetadata[locale];
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.title = translate(locale, "Student Task Manager");
  }, [locale, dir]);
  return {
    locale,
    dir,
    setLocale,
    t: (key: MessageKey, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    message: (value: string) => errorMessage(locale, value),
    taskCount: (value: number) => formatTaskCount(locale, value),
    number: (value: number) => new Intl.NumberFormat(locale).format(value),
    date: (
      value: string,
      timeZone: string,
      options: Intl.DateTimeFormatOptions = {
        dateStyle: "medium",
        timeStyle: "short",
      },
    ) =>
      new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone,
        calendar: "gregory",
      }).format(new Date(value)),
  };
}
