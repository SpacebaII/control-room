import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const testOrigin = process.env.CONTROL_ROOM_URL ?? "http://127.0.0.1:5174";
const mutationHeaders = (actor: string) => ({ Origin: testOrigin, "X-Control-Room-Actor": actor });
import type { Portfolio, Project } from "../src/domain/model";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good morning/ })).toBeVisible();
  await page.getByRole("button", { name: "Reset workspace" }).click();
});

test("updates a critical milestone and persists the new aggregate version", async ({ page }) => {
  await page.getByRole("link", { name: /Field scheduling platform rollout/ }).click();
  await page.getByRole("link", { name: "plan", exact: true }).click();
  await expect(page.getByText(/Updated .* · version 7/)).toBeVisible();
  const beforePortfolio = await (await page.request.get("/api/v1/portfolio")).json() as Portfolio;
  const before = beforePortfolio.projects.find((project) => project.id === "platform") as Project;
  const beforeForecast = before.milestones.find((item) => item.id === "plt-m2")!.forecastDate;
  await page.getByRole("button", { name: "Move Dispatcher pilot exit +7 days" }).click();
  await expect(page.getByText(/version 8/)).toBeVisible();
  const afterPortfolio = await (await page.request.get("/api/v1/portfolio")).json() as Portfolio;
  const after = afterPortfolio.projects.find((project) => project.id === "platform") as Project;
  const afterForecast = after.milestones.find((item) => item.id === "plt-m2")!.forecastDate;
  expect(Date.parse(afterForecast) - Date.parse(beforeForecast)).toBe(7 * 24 * 60 * 60 * 1000);
});

test("keeps visitor workspaces isolated", async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const firstPage = await first.newPage();
  const secondPage = await second.newPage();
  await Promise.all([firstPage.goto("/"), secondPage.goto("/")]);
  const firstPortfolio = await (await firstPage.request.get("/api/v1/portfolio")).json() as Portfolio;
  const secondPortfolio = await (await secondPage.request.get("/api/v1/portfolio")).json() as Portfolio;
  const firstProject = firstPortfolio.projects.find((project) => project.id === "hub")!;
  const milestone = firstProject.milestones.find((item) => item.id === "hub-m2")!;
  const response = await firstPage.request.patch(`/api/v1/projects/hub/milestones/${milestone.id}`, { headers: mutationHeaders("alex"), data: { version: firstProject.version, forecastDate: "2026-09-20T00:00:00.000Z" } });
  expect(response.ok()).toBeTruthy();
  const afterFirst = await (await firstPage.request.get("/api/v1/portfolio")).json() as Portfolio;
  const afterSecond = await (await secondPage.request.get("/api/v1/portfolio")).json() as Portfolio;
  expect(afterFirst.projects.find((project) => project.id === "hub")?.version).toBe(firstProject.version + 1);
  expect(afterSecond.projects.find((project) => project.id === "hub")?.version).toBe(secondPortfolio.projects.find((project) => project.id === "hub")?.version);
  await Promise.all([first.close(), second.close()]);
});

test("enforces persona permissions through the API", async ({ page }) => {
  const portfolioResponse = await page.request.get("/api/v1/portfolio");
  const portfolioBody = await portfolioResponse.text();
  expect(portfolioResponse.ok(), portfolioBody).toBeTruthy();
  const portfolio = JSON.parse(portfolioBody) as Portfolio;
  const project = portfolio.projects.find((item) => item.id === "platform")!;
  const denied = await page.request.post("/api/v1/projects/platform/changes/plt-c1/decision", { headers: mutationHeaders("priya"), data: { version: project.version, decision: "approved", note: "Approved for test." } });
  expect(denied.status()).toBe(403);
  const approved = await page.request.post("/api/v1/projects/platform/changes/plt-c1/decision", { headers: mutationHeaders("dana"), data: { version: project.version, decision: "approved", note: "Approved with twice-weekly recovery checkpoints." } });
  expect(approved.ok()).toBeTruthy();
});

test("runs the public copilot without contacting a model provider", async ({ page }) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("api.openai.com")) providerRequests.push(request.url()); });
  await page.getByRole("link", { name: /Copilot/ }).click();
  await expect(page.getByText("Deterministic public provider")).toBeVisible();
  await page.getByRole("button", { name: "Run evidence review" }).click();
  await expect(page.getByRole("heading", { name: /Control scan found/ })).toBeVisible();
  expect(providerRequests).toEqual([]);
});

test("mobile prioritizes communication and files without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toContainText("TodayInboxFilesMore");
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  await page.getByRole("link", { name: "Files", exact: true }).click();
  await expect(page.getByRole("heading", { name: "File room" })).toBeVisible();
  const download = await page.request.get("/api/v1/files/file-budget/download");
  expect(download.ok()).toBeTruthy();
  expect(download.headers()["content-disposition"]).toContain("program-budget-forecast.xlsx");
});

test("updates budget forecast and resolves a recorded capacity conflict", async ({ page }) => {
  await page.goto("/projects/platform/budget");
  await expect(page.getByText(/Updated .* · version 7/)).toBeVisible();
  await page.getByRole("button", { name: "Add $10K" }).first().click();
  await expect(page.getByText(/version 8/)).toBeVisible();
  await page.getByRole("link", { name: "team", exact: true }).click();
  await expect(page.getByText("2 conflict(s)")).toBeVisible();
  await page.getByRole("button", { name: "Resolve to 90%" }).first().click();
  await expect(page.getByText("1 conflict(s)")).toBeVisible();
});

test("approves and implements a change with separate sponsor and manager personas", async ({ page }) => {
  await page.goto("/projects/platform/changes");
  await page.getByLabel("Acting as").selectOption("dana");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();
  await page.getByLabel("Acting as").selectOption("alex");
  await page.getByRole("button", { name: "Implement baseline change" }).click();
  await expect(page.getByText("implemented", { exact: true })).toBeVisible();
});

test("moves a report through review, approval, publication, and print", async ({ page }) => {
  await page.goto("/projects/hub/reports");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.getByLabel("Acting as").selectOption("dana");
  await page.getByRole("button", { name: "Approve report" }).click();
  await page.getByRole("button", { name: "Publish internally" }).click();
  await expect(page.getByText(/published/).first()).toBeVisible();
  const printHref = await page.getByRole("link", { name: "Print brief" }).getAttribute("href");
  expect(printHref).toBe("/api/v1/reports/report-hub/print");
});

test("requires preview approval before simulated channel delivery", async ({ page }) => {
  await page.goto("/projects/hub/comms");
  await page.getByLabel("Channel").selectOption("slack");
  await page.getByLabel("Audience").fill("Denver opening team");
  await page.getByLabel("Message").fill("Fire marshal corrections are due Thursday. Marcus owns evidence before Friday commissioning.");
  await page.getByRole("button", { name: "Create delivery preview" }).click();
  await expect(page.getByText("preview", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Approve simulated delivery" }).click();
  await expect(page.getByText("delivered", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Nothing leaves the demo")).toBeVisible();
});

test("selectively applies a copilot risk proposal and closes the accepted risk", async ({ page }) => {
  await page.goto("/copilot");
  await page.getByLabel("Project").selectOption("hub");
  await page.getByRole("button", { name: "Run evidence review" }).click();
  await page.getByRole("button", { name: "Apply selected changes" }).click();
  await expect(page.getByText("applied", { exact: true })).toBeVisible();
  await page.goto("/projects/hub/raid");
  await expect(page.getByText("Blocked delivery item may compress downstream validation time")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).first().click();
  await expect(page.getByText("closed", { exact: true }).first()).toBeVisible();
});

test("meets serious accessibility checks on desktop and mobile", async ({ page }) => {
  const desktop = await new AxeBuilder({ page }).analyze();
  expect(desktop.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today");
  const mobile = await new AxeBuilder({ page }).analyze();
  expect(mobile.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("rejects stale writes and unauthenticated live AI while returning security headers", async ({ page }) => {
  const response = await page.request.get("/api/v1/portfolio");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["x-correlation-id"]).toBeTruthy();
  const portfolioBody = await response.text();
  expect(response.ok(), portfolioBody).toBeTruthy();
  const portfolio = JSON.parse(portfolioBody) as Portfolio;
  const project = portfolio.projects.find((item) => item.id === "hub")!;
  const first = await page.request.patch("/api/v1/projects/hub/budget/hub-b1", { headers: mutationHeaders("alex"), data: { version: project.version, forecast: 530000 } });
  expect(first.ok()).toBeTruthy();
  const stale = await page.request.patch("/api/v1/projects/hub/budget/hub-b1", { headers: mutationHeaders("alex"), data: { version: project.version, forecast: 540000 } });
  expect(stale.status()).toBe(409);
  const staleBody = await stale.json() as { current: { version: number } };
  expect(staleBody.current.version).toBe(project.version + 1);
  const live = await page.request.post("/api/v1/copilot/runs", { headers: mutationHeaders("alex"), data: { projectId: "hub", action: "risk_scan", input: "", mode: "live" } });
  expect(live.status()).toBe(401);
});

test("prevents document overflow at every supported breakpoint", async ({ page }) => {
  for (const width of [390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/projects/platform/overview");
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
    expect(dimensions.document, `overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
  }
});

test("loads every primary workspace without console errors or dead navigation", async ({ page }) => {
  const consoleErrors: string[] = [];
  let currentRoute = "/";
  page.on("console", (entry) => { if (entry.type() === "error") consoleErrors.push(`${currentRoute}: ${entry.text()}`); });
  const routes = [
    "/", "/inbox", "/files", "/reports", "/copilot",
    ...["overview", "plan", "raid", "decisions", "budget", "team", "changes", "reports", "comms", "activity"].map((section) => `/projects/platform/${section}`),
  ];
  for (const route of routes) {
    currentRoute = route;
    const response = await page.goto(route);
    expect(response?.ok(), `Route failed: ${route}`).toBeTruthy();
    await expect(page.locator("main")).toBeVisible();
  }
  expect(consoleErrors).toEqual([]);
});
