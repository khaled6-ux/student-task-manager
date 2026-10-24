import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useRef, useState } from "react";
import { ConfirmationDialog } from "../src/components/ConfirmationDialog";
import { useI18n, setLocale } from "../src/i18n/useI18n";
import { translate } from "../src/i18n/catalog";

function Harness({ busy = false, error = "", removed = false }) {
  const [open, setOpen] = useState(false);
  const fallback = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const { t } = useI18n();
  return (
    <>
      <button ref={fallback}>{t("New task")}</button>
      {!removed && (
        <button
          onClick={(event) => {
            trigger.current = event.currentTarget;
            setOpen(true);
          }}
        >
          {t("Delete")}
        </button>
      )}
      {open && (
        <ConfirmationDialog
          title={t("Confirm task deletion")}
          cancelLabel={t("Cancel deletion")}
          confirmLabel={t("Confirm delete")}
          returnFocus={trigger}
          fallbackFocus={fallback}
          busy={busy}
          error={error}
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        >
          <p>
            {t("Delete “{name}”? This cannot be undone.", {
              name: "任务 مهمة task",
            })}
          </p>
        </ConfirmationDialog>
      )}
    </>
  );
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  setLocale("en");
  vi.restoreAllMocks();
});

test.each(["en", "ar", "zh-CN"] as const)(
  "%s: confirmation labels, cancel focus, Tab trap and Escape restoration",
  async (locale) => {
    setLocale(locale);
    const t = (
      key:
        | "Delete"
        | "Cancel deletion"
        | "Confirm delete"
        | "Confirm task deletion",
    ) => translate(locale, key);
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: t("Delete") });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", {
      name: t("Confirm task deletion"),
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const cancel = within(dialog).getByRole("button", {
      name: t("Cancel deletion"),
    });
    const confirm = within(dialog).getByRole("button", {
      name: t("Confirm delete"),
    });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toHaveFocus();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
);

test("successful deletion restores a surviving fallback when the trigger is removed", async () => {
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  view.rerender(<Harness removed />);
  fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "New task" })).toHaveFocus(),
  );
});

test("pending deletion stays modal and failed deletion announces an error with recovery", async () => {
  const view = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  view.rerender(<Harness busy />);
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(dialog).toHaveFocus();
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  view.rerender(<Harness error="Unable to delete task" />);
  expect(within(dialog).getByRole("alert")).toHaveTextContent(
    "Unable to delete task",
  );
  expect(screen.getByRole("button", { name: "Cancel deletion" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
  await act(async () => {});
  expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
});
