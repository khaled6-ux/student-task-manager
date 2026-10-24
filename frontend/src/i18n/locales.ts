export type SupportedLocale = "en" | "ar" | "zh-CN";
export const localeMetadata = {
  en: { lang: "en", dir: "ltr", name: "English" },
  ar: { lang: "ar", dir: "rtl", name: "العربية" },
  "zh-CN": { lang: "zh-CN", dir: "ltr", name: "简体中文" },
} as const;
export const localeStorageKey = "student-task-manager.locale";
export function isLocale(value: unknown): value is SupportedLocale {
  return value === "en" || value === "ar" || value === "zh-CN";
}
