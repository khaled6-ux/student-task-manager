// Optional browser regression suite. Only synthetic sessions and intercepted API fixtures.
// See docs/v1-i18n.md for isolated tooling install/run commands.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const output = process.env.I18N_PREVIEW_DIR || "/tmp/student-i18n-previews";
const base = process.env.I18N_PREVIEW_URL || "http://127.0.0.1:5175";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const owner = "00000000-0000-4000-8000-000000000001";
const stamp = "2026-10-01T00:00:00Z";
const course = {
  id: "fixture-course",
  user_id: owner,
  name: "Mathematics 数学 رياضيات",
  code: "MATH",
  color: "#226b55",
  created_at: stamp,
  updated_at: stamp,
};
const task = {
  id: "fixture-task",
  user_id: owner,
  course_id: course.id,
  title: "Worksheet 练习 ورقة عمل",
  description: null,
  status: "todo",
  priority: "medium",
  category: "homeworks",
  due_at: "2026-10-22T18:00:00Z",
  completed_at: null,
  created_at: stamp,
  updated_at: stamp,
};
const results = [];
await mkdir(output, { recursive: true });
try {
  await Promise.all(
    ["en", "ar", "zh-CN"].map(async (locale) => {
      for (const [size, width, height] of [
        ["desktop", 1440, 1000],
        ["tablet", 820, 1180],
        ["mobile", 390, 844],
        ["narrow", 320, 740],
      ]) {
        for (const mode of [
          "landing",
          "dashboard",
          "task-form",
          "course-form",
          "calendar",
          "profile",
          "delete-task",
          "delete-course",
        ]) {
          const context = await browser.newContext({
            viewport: { width, height },
            reducedMotion: "reduce",
          });
          const page = await context.newPage();
          const errors = [];
          const requests = [];
          let fixtureTasks = [task];
          let fixtureCourses = [course];
          page.on("pageerror", (error) => errors.push(error.message));
          await context.addInitScript(
            ({ locale, owner, mode }) => {
              localStorage.setItem("student-task-manager.locale", locale);
              if (mode !== "landing") {
                const exp = Math.floor(Date.now() / 1000) + 3600;
                const part = (value) =>
                  btoa(JSON.stringify(value))
                    .replaceAll("=", "")
                    .replaceAll("+", "-")
                    .replaceAll("/", "_");
                const token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: owner, exp, role: "authenticated" })}.fixture-signature`;
                localStorage.setItem(
                  "sb-project-auth-token",
                  JSON.stringify({
                    access_token: token,
                    refresh_token: "fixture-refresh",
                    expires_at: exp,
                    expires_in: 3600,
                    token_type: "bearer",
                    user: {
                      id: owner,
                      aud: "authenticated",
                      role: "authenticated",
                      email: "fixture@example.test",
                      app_metadata: {},
                      user_metadata: {},
                      created_at: "2026-10-01T00:00:00Z",
                    },
                  }),
                );
              }
            },
            { locale, owner, mode },
          );
          // Catch every outbound request: the browser never reaches Supabase or a real backend.
          await page.route("**/*", async (route) => {
            const url = new URL(route.request().url());
            if (url.origin === new URL(base).origin) return route.continue();
            if (url.pathname.startsWith("/api/v1/")) {
              requests.push(url.pathname);
              if (route.request().method() === "DELETE") {
                if (url.pathname.includes("/courses/")) {
                  fixtureCourses = [];
                  fixtureTasks = fixtureTasks.map((item) => ({
                    ...item,
                    course_id: null,
                  }));
                } else fixtureTasks = [];
                return route.fulfill({
                  status: 204,
                  body: "",
                  headers: { "Access-Control-Allow-Origin": "*" },
                });
              }

              const item = url.pathname.endsWith("/me")
                ? {
                    id: owner,
                    display_name: "Student 学生 طالب",
                    timezone: "Asia/Shanghai",
                  }
                : url.pathname.endsWith("/courses")
                  ? { items: fixtureCourses, total: 1, limit: 100, offset: 0 }
                  : { items: fixtureTasks, total: 1, limit: 100, offset: 0 };
              return route.fulfill({
                json: item,
                headers: { "Access-Control-Allow-Origin": "*" },
              });
            }
            return route.abort();
          });
          await page.goto(base, { waitUntil: "networkidle" });
          if (mode === "landing") {
            await page.locator(".welcome").waitFor();
            await page.keyboard.press("Tab");
            if (
              (await page.locator(":focus").getAttribute("class")) !==
              "welcome-skip"
            )
              throw new Error("Skip link keyboard order");
            await page.keyboard.press("Enter");
            if (
              (await page.locator(":focus").getAttribute("id")) !==
              "welcome-main"
            )
              throw new Error("Skip link focus");
            await page.locator('[aria-controls="welcome-features"]').click();
            if (
              (await page.locator(":focus").getAttribute("id")) !==
              "welcome-features"
            )
              throw new Error("Section keyboard focus");
            if (new URL(page.url()).hash)
              throw new Error("Landing URL changed");
            if (
              (await page
                .locator(".welcome-enter")
                .first()
                .evaluate((el) => getComputedStyle(el).animationName)) !==
              "none"
            )
              throw new Error("Reduced motion ignored");
          } else {
            await page.getByText(task.title, { exact: true }).waitFor();
            if (mode === "task-form")
              await page.locator(".section-heading button").click();
            if (mode === "course-form") {
              await page.locator('nav a[href="#/courses"]').click();
              await page.locator("main > button").click();
            }
            if (mode === "calendar")
              await page.locator('nav a[href="#/calendar"]').click();
            if (mode === "delete-task" || mode === "delete-course") {
              if (mode === "delete-course")
                await page.locator('nav a[href="#/courses"]').click();
              const trigger =
                mode === "delete-course"
                  ? page
                      .locator(".section-cards .actions button:last-child")
                      .first()
                  : page
                      .locator(".task-list .actions button:last-child")
                      .first();
              await trigger.focus();
              await page.keyboard.press("Enter");
              const dialog = page.getByRole("dialog");
              const modalAudit = await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
                .analyze();
              if (modalAudit.violations.length)
                throw new Error(
                  `Modal accessibility: ${JSON.stringify(modalAudit.violations.map((v) => v.id))}`,
                );

              const cancel = dialog.getByRole("button").first();
              const confirm = dialog.getByRole("button").last();
              if (
                !(await cancel.evaluate((el) => el === document.activeElement))
              )
                throw new Error("Dialog initial focus");
              await page.keyboard.press("Shift+Tab");
              if (
                !(await confirm.evaluate((el) => el === document.activeElement))
              )
                throw new Error("Dialog backward trap");
              await page.keyboard.press("Tab");
              if (
                !(await cancel.evaluate((el) => el === document.activeElement))
              )
                throw new Error("Dialog forward trap");
              await page.keyboard.press("Escape");
              if (await dialog.count()) throw new Error("Escape failed");
              if (
                !(await trigger.evaluate((el) => el === document.activeElement))
              )
                throw new Error("Dialog restore trigger");
              await page.keyboard.press("Enter");
              await page.keyboard.press("Shift+Tab");
              await page.keyboard.press("Enter");
              await dialog.waitFor({ state: "detached" });
              const fallback =
                mode === "delete-course"
                  ? page.locator("main > button")
                  : page.locator(".section-heading > button");
              if (
                !(await fallback.evaluate(
                  (el) => el === document.activeElement,
                ))
              )
                throw new Error("Dialog restore after deletion");
            }
            if (mode === "profile")
              await page.locator('nav a[href="#/profile"]').click();
            if (mode.endsWith("-form")) await page.locator("form").waitFor();
            const count = requests.length;
            await page
              .locator(".language-selector select")
              .selectOption(locale === "en" ? "ar" : "en");
            await page
              .locator(".language-selector select")
              .selectOption(locale);
            if (requests.length !== count)
              throw new Error("Switching language triggered API request");
            if (width > 650) {
              const side = await page.locator(".sidebar").boundingBox();
              const main = await page.locator("main").boundingBox();
              if (locale === "ar" ? side.x < main.x : side.x > main.x)
                throw new Error("Incorrect sidebar direction");
            }
          }
          const documentState = await page.evaluate(() => ({
            lang: document.documentElement.lang,
            dir: document.documentElement.dir,
            overflow: document.documentElement.scrollWidth > innerWidth,
          }));
          const audit = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          const violations = audit.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          }));
          const result = {
            locale,
            size,
            mode,
            ...documentState,
            pageErrors: errors,
            violations,
          };
          results.push(result);
          if (documentState.overflow || errors.length || violations.length)
            console.log(JSON.stringify(result));
          if (
            ["landing", "dashboard", "task-form", "calendar"].includes(mode) &&
            ["desktop", "mobile"].includes(size)
          )
            await page.screenshot({
              path: `${output}/${locale}-${size}-${mode}.png`,
              fullPage: true,
            });
          await context.close();
        }
      }
    }),
  );
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  const failures = results.filter(
    (r) =>
      r.overflow ||
      r.pageErrors.length ||
      r.violations.length ||
      r.lang !== r.locale ||
      r.dir !== (r.locale === "ar" ? "rtl" : "ltr"),
  );
  console.log(`${results.length} browser scenarios, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
