import { expect, test } from "vitest";
import { dayKey, instantFromLocal, localInput } from "../src/lib/dates";

test.each([
  ["Asia/Shanghai", "2026-10-26T23:17", "2026-10-26T15:17:00.000Z"],
  ["UTC", "2026-10-26T23:17", "2026-10-26T23:17:00.000Z"],
  ["America/Los_Angeles", "2026-10-26T23:17", "2026-10-27T06:17:00.000Z"],
  ["Asia/Kathmandu", "2026-10-26T23:17", "2026-10-26T17:32:00.000Z"],
  ["Australia/Lord_Howe", "2026-04-05T01:45", "2026-04-04T14:45:00.000Z"],
])("conversion round-trips in %s", (zone, wall, iso) => {
  expect(instantFromLocal(wall, zone)).toBe(iso);
  expect(localInput(iso, zone)).toBe(wall);
  expect(dayKey(iso, zone)).toBe(wall.slice(0, 10));
});
test.each([
  ["America/Los_Angeles", "2026-03-08T02:30"],
  ["Europe/Berlin", "2026-03-29T02:30"],
  ["Australia/Lord_Howe", "2026-10-04T02:15"],
  ["Pacific/Apia", "2011-12-30T12:00"],
])("rejects nonexistent wall times in %s", (zone, wall) => {
  expect(() => instantFromLocal(wall, zone)).toThrow(
    "Choose a valid local date and time.",
  );
});
test("fall-back chooses earlier and formats both occurrences equally", () => {
  expect(instantFromLocal("2026-11-01T01:30", "America/Los_Angeles")).toBe(
    "2026-11-01T08:30:00.000Z",
  );
  expect(localInput("2026-11-01T09:30:42.123Z", "America/Los_Angeles")).toBe(
    "2026-11-01T01:30",
  );
});
test("midnight, empty values, invalid calendar values and explicit instant offsets", () => {
  expect(localInput("2026-10-26T16:00:00Z", "Asia/Shanghai")).toBe(
    "2026-10-27T00:00",
  );
  expect(localInput(null, "UTC")).toBe("");
  expect(instantFromLocal("", "UTC")).toBeNull();
  for (const value of ["invalid", "2026-02-30T23:17", "2026-10-26T24:17"])
    expect(() => instantFromLocal(value, "Asia/Shanghai")).toThrow(
      "Choose a valid",
    );
  expect(() => localInput("2026-10-26T23:17", "Asia/Shanghai")).toThrow(
    "Choose a valid",
  );
  expect(localInput("2026-10-26T23:17:00+08:00", "Asia/Shanghai")).toBe(
    "2026-10-26T23:17",
  );
});
