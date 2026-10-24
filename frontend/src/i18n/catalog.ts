import { messages as en } from "./messages/en";
import { messages as ar } from "./messages/ar";
import { messages as zh } from "./messages/zh-CN";
import type { SupportedLocale } from "./locales";
export type MessageKey = keyof typeof en;
export const catalogs: Record<SupportedLocale, Record<MessageKey, string>> = {
  en,
  ar,
  "zh-CN": zh,
};
export function translate(
  locale: SupportedLocale,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  return catalogs[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    values[name] === undefined ? match : String(values[name]),
  );
}
// Only known application errors are presented. Never expose arbitrary SDK/server details.
export function errorMessage(locale: SupportedLocale, message: string): string {
  return Object.hasOwn(catalogs.en, message)
    ? translate(locale, message as MessageKey)
    : translate(locale, "The request failed. Please retry.");
}

export function formatTaskCount(
  locale: SupportedLocale,
  count: number,
): string {
  const category = new Intl.PluralRules(locale).select(count);
  return translate(locale, `taskCount.${category}`, {
    count: new Intl.NumberFormat(locale).format(count),
  });
}
