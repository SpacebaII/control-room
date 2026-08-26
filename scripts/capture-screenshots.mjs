import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseURL = process.env.CONTROL_ROOM_URL ?? "http://127.0.0.1:5173";
const output = new URL("../docs/screenshots/", import.meta.url);
await fs.mkdir(output, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(baseURL);
await page.getByRole("heading", { name: /Good morning/ }).waitFor();
await page.getByRole("button", { name: "Reset workspace" }).click();
await page.screenshot({ path: fileURLToPath(new URL("portfolio-desktop.png", output)), fullPage: true });

await page.setViewportSize({ width: 1024, height: 900 });
await page.goto(`${baseURL}/projects/platform/overview`);
await page.getByRole("heading", { name: "Field scheduling platform rollout" }).waitFor();
await page.screenshot({ path: fileURLToPath(new URL("project-tablet.png", output)), fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${baseURL}/today`);
await page.getByRole("heading", { name: /Good morning/ }).waitFor();
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: fileURLToPath(new URL("today-mobile.png", output)), fullPage: false });

await browser.close();
console.log("Captured desktop, tablet, and mobile screenshots from the seeded application.");
