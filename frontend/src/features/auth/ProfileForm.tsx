import { useState } from "react";
import type { FormEvent } from "react";
import { useData } from "../../app/dataContext";

export function ProfileForm() {
  const { profile, api, mutate, busy } = useData();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const timezone = String(form.get("timezone")).trim();
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      await mutate(() =>
        api.updateProfile({
          display_name: String(form.get("display_name")).trim() || null,
          timezone,
        }),
      );
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
        <h1>Profile</h1>
      </section>
      <form className="editor card" onSubmit={submit}>
        <label>
          Display name
          <input
            name="display_name"
            maxLength={100}
            defaultValue={profile?.display_name ?? ""}
          />
        </label>
        <label>
          Timezone
          <input
            name="timezone"
            required
            maxLength={64}
            defaultValue={profile?.timezone ?? "UTC"}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">Profile saved.</p>}
        <button disabled={busy}>Save profile</button>
      </form>
    </>
  );
}
