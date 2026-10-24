import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  catalogs,
  errorMessage,
  formatTaskCount,
  translate,
} from "../src/i18n/catalog";
import type { MessageKey } from "../src/i18n/catalog";
import { landingEnglish } from "../src/i18n/landing.en";
import { localeMetadata, localeStorageKey } from "../src/i18n/locales";
import type { SupportedLocale } from "../src/i18n/locales";
import { setLocale, useI18n } from "../src/i18n/useI18n";
import { LanguageSelector } from "../src/i18n/LanguageSelector";
import { LandingPage } from "../src/features/landing/LandingPage";

import ts from "typescript";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  setLocale("en");
});

for (const locale of Object.keys(localeMetadata) as SupportedLocale[]) {
  test(`${locale}: exact nonempty catalog coverage and matching interpolation variables`, () => {
    expect(Object.keys(catalogs[locale]).sort()).toEqual(
      Object.keys(catalogs.en).sort(),
    );
    for (const key of Object.keys(catalogs.en) as MessageKey[]) {
      expect(catalogs[locale][key].trim()).not.toBe("");
      const parameters = (text: string) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      if (
        !(locale === "ar" && ["taskCount.one", "taskCount.two"].includes(key))
      )
        expect(parameters(catalogs[locale][key]), key).toEqual(
          parameters(catalogs.en[key]),
        );
    }
  });
  test(`${locale}: landing page, accessible selector and document direction`, () => {
    setLocale(locale);
    const signIn = vi.fn(async () => {});
    render(<LandingPage configured error="" onSignIn={signIn} />);
    expect(document.documentElement.lang).toBe(locale);
    expect(document.documentElement.dir).toBe(localeMetadata[locale].dir);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      translate(locale, "Less chaos."),
    );
    expect(
      screen.getByRole("combobox", { name: translate(locale, "Language") }),
    ).toHaveValue(locale);
    fireEvent.click(
      screen.getByRole("button", { name: translate(locale, "Get started") }),
    );
    expect(signIn).toHaveBeenCalledTimes(1);
  });
}

test("all authored landing copy is covered; numbers and course codes are intentional literals", () => {
  function walk(value: unknown) {
    if (typeof value === "string") {
      if (!/^\d+$|^(ENG|DES|MATH) \d+$/.test(value))
        expect(Object.hasOwn(catalogs.en, value), value).toBe(true);
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      Object.values(value).forEach(walk);
  }
  walk(landingEnglish);
});

test("no hardcoded JSX interface copy or accessible labels can bypass translation", () => {
  const sources = import.meta.glob("../src/**/*.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  for (const [path, source] of Object.entries(sources)) {
    const ast = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function walk(node: ts.Node) {
      if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text))
        expect(["S", "ST"], path).toContain(node.text.trim());
      if (
        ts.isJsxAttribute(node) &&
        ["aria-label", "title", "placeholder"].includes(
          node.name.getText(ast),
        ) &&
        node.initializer
      )
        expect(ts.isStringLiteral(node.initializer), path).toBe(false);
      ts.forEachChild(node, walk);
    }
    walk(ast);
  }
});

test("selection survives unmount/remount and synchronizes across browser tabs", () => {
  const { unmount } = render(<LanguageSelector />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "ar" } });
  expect(localStorage.getItem(localeStorageKey)).toBe("ar");
  unmount();
  render(<LanguageSelector />);
  expect(screen.getByRole("combobox")).toHaveValue("ar");
  act(() => {
    localStorage.setItem(localeStorageKey, "zh-CN");
    window.dispatchEvent(
      new StorageEvent("storage", { key: localeStorageKey }),
    );
  });
  expect(screen.getByRole("combobox")).toHaveValue("zh-CN");
  expect(document.documentElement.dir).toBe("ltr");
});

test("invalid saved locales default to English and blocked storage does not break switching", () => {
  localStorage.setItem(localeStorageKey, "unsupported");
  render(<LanguageSelector />);
  expect(screen.getByRole("combobox")).toHaveValue("en");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked");
  });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "ar" } });
  expect(screen.getByRole("combobox")).toHaveValue("ar");
});

test("dates honor the selected locale and profile timezone without translating content", () => {
  function Probe() {
    const { date } = useI18n();
    return <output>{date("2026-10-22T18:00:00Z", "Asia/Shanghai")}</output>;
  }
  render(<Probe />);
  for (const locale of ["en", "ar", "zh-CN"] as const) {
    act(() => setLocale(locale));
    expect(screen.getByRole("status")).toHaveTextContent(
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Shanghai",
        calendar: "gregory",
      }).format(new Date("2026-10-22T18:00:00Z")),
    );
  }
  expect(formatTaskCount("en", 1)).toBe("1 task");
  expect(formatTaskCount("en", 2)).toBe("2 tasks");
  expect(formatTaskCount("zh-CN", 2)).toBe("2 项任务");
  expect(
    new Set([0, 1, 2, 3, 11, 100].map((value) => formatTaskCount("ar", value)))
      .size,
  ).toBe(6);
  expect(
    translate("ar", "Delete “{name}”? This cannot be undone.", {
      name: "Math 数学 رياضيات",
    }),
  ).toContain("Math 数学 رياضيات");
  expect(errorMessage("ar", "Unexpected SDK secret details")).toBe(
    translate("ar", "The request failed. Please retry."),
  );
});

test("Arabic and Chinese catalogs contain target-language text for every message", () => {
  for (const value of Object.values(catalogs.ar))
    expect(value).toMatch(/[\u0600-\u06ff]/);
  for (const value of Object.values(catalogs["zh-CN"]))
    expect(value).toMatch(/[\u4e00-\u9fff]/);
});
