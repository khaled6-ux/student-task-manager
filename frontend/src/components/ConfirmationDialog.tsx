import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";

// Native modal supplies top-layer rendering and makes the background inert.
export function ConfirmationDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  busy,
  error,
  onConfirm,
  onCancel,
  returnFocus,
  fallbackFocus,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  fallbackFocus: RefObject<HTMLButtonElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const trigger = returnFocus.current;
    const fallback = fallbackFocus.current;
    element.showModal();
    cancel.current?.focus();
    return () => {
      element.close();
      queueMicrotask(() => {
        const target =
          trigger?.isConnected && !trigger.hasAttribute("disabled")
            ? trigger
            : fallback;
        target?.focus();
      });
    };
  }, [returnFocus, fallbackFocus]);
  useEffect(() => {
    // Disabled controls cannot hold focus while a server-confirmed write is pending.
    if (busy) dialog.current?.focus();
    else cancel.current?.focus();
  }, [busy]);
  return (
    <dialog
      ref={dialog}
      className="confirmation-dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        ];
        const first = buttons[0];
        const last = buttons.at(-1);
        if (!first) {
          event.preventDefault();
          event.currentTarget.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === event.currentTarget)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === event.currentTarget)
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <div id={descriptionId}>{children}</div>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button ref={cancel} disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
