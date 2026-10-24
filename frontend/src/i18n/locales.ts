// Metadata only: English is the sole enabled locale. No untranslated language switcher.
export type SupportedLocale = "en" | "ar" | "zh";
export const localeMetadata: Record<
  SupportedLocale,
  { lang: string; dir: "ltr" | "rtl" }
> = {
  en: { lang: "en", dir: "ltr" },
  ar: { lang: "ar", dir: "rtl" },
  zh: { lang: "zh", dir: "ltr" },
};
export const landingLocale: SupportedLocale = "en";
