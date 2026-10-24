import { useI18n } from "./useI18n";
import { isLocale, localeMetadata } from "./locales";
export function LanguageSelector() {
  const { locale, t, setLocale } = useI18n();
  return (
    <label className="language-selector">
      <span>{t("Language")}</span>
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
      >
        {Object.entries(localeMetadata).map(([value, meta]) => (
          <option key={value} value={value} lang={meta.lang}>
            {meta.name}
          </option>
        ))}
      </select>
    </label>
  );
}
