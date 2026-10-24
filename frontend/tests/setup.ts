import "@testing-library/jest-dom/vitest";

// jsdom lacks the browser's top-layer dialog methods. Focus/trapping is still
// exercised by unit tests; inert background/Escape are verified in Chromium.
Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  configurable: true,
  value() {
    this.setAttribute("open", "");
  },
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  configurable: true,
  value() {
    this.removeAttribute("open");
  },
});
