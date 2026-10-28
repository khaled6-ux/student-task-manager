# Profile-timezone deadline entry

The task editor now uses the saved profile's IANA timezone (UTC fallback), matching dashboard display and calendar grouping. `2026-10-26 23:17` in `Asia/Shanghai` becomes `2026-10-26T15:17:00.000Z` and displays as 23:17 again, independent of the computer's timezone.

`localInput(instant, timeZone)` renders explicit Gregorian/Latin wall-clock fields. `instantFromLocal(value, timeZone)` discovers offsets on both sides of nearby transitions and accepts only candidates that round-trip to the entered wall time. Neither conversion assumes the browser timezone. Invalid dates and nonexistent DST times are rejected, including half-hour gaps and skipped days. Newly entered ambiguous fall-back times consistently choose the earlier instant; selecting the later occurrence would require an additional UI choice.

An unchanged editor field preserves the original timestamp exactly, including seconds/milliseconds and a later fall-back occurrence. Existing saved timestamps are not rewritten. Previously saved incorrect instants cannot be inferred or automatically repaired; users may deliberately edit them using the corrected profile-zone field. No backend/schema change or database migration is needed.

The label identifies the profile timezone in English, Arabic, and Simplified Chinese. Regression tests cover Shanghai creation/storage/display/editor/calendar consistency, unchanged edits, fractional offsets, midnight/empty/invalid inputs, gaps, ambiguity and host-timezone independence.

Validation: 109 frontend tests passed; the 11 conversion cases also passed with host timezones `America/New_York` and `Pacific/Auckland`. Frontend lint, explicit TypeScript checks, production build and Git whitespace checks passed. The existing Vite >500 kB chunk advisory remains. Backend code and database records were untouched.
