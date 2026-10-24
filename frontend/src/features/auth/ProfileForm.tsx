import { useI18n } from "../../i18n/useI18n";
import { useState } from "react";
import type { FormEvent } from "react";
import { useData } from "../../app/dataContext";

export function ProfileForm() {
  const { t, message } = useI18n();
  const { profile, api, mutate, busy } = useData();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const timezone = String(form.get("timezone")).trim();
    if (!event.currentTarget.checkValidity()) {
      setError("Please check the form values and deadline timezone.");
      return;
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      await mutate({
        kind: "profile-save",
        write: () =>
          api.updateProfile({
            display_name: String(form.get("display_name")).trim() || null,
            timezone,
          }),
      });
      setSaved(true);
    } catch (error) {
      setError(
        error instanceof RangeError
          ? "Enter a valid IANA timezone, such as Asia/Shanghai."
          : error instanceof Error
            ? error.message
            : "Unable to save profile.",
      );
    }
  };
  return (
    <>
      <section className="intro">
        <h1>{t("Profile")}</h1>
      </section>
      <form noValidate className="editor card" onSubmit={submit}>
        <label>
          {t("Display name")}
          <input
            name="display_name"
            dir="auto"
            maxLength={100}
            defaultValue={profile?.display_name ?? ""}
          />
        </label>
        <label>
          {t("Timezone")}
          <input
            name="timezone"
            required
            maxLength={64}
            defaultValue={profile?.timezone ?? "UTC"}
          />
        </label>
        {error && <p role="alert">{message(error)}</p>}
        {saved && <p role="status">{t("Profile saved.")}</p>}
        <button disabled={busy}>
          {busy ? t("Saving…") : t("Save profile")}
        </button>
      </form>
    </>
  );
}
