import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const site = "https://tutor.richmackos.com";
const user = process.env.RICH_TUTOR_DOC_USER;
const pass = process.env.RICH_TUTOR_DOC_PASS;

if (!user || !pass) {
  throw new Error("Documentation credentials were not supplied.");
}

const output = path.resolve("../../docs/screenshots");

fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({
  headless: true
});

const context = await browser.newContext({
  viewport: {
    width: 1440,
    height: 1050
  },
  deviceScaleFactor: 1
});

const page = await context.newPage();

async function capture(name, url, fullPage = true) {
  console.log(`Capturing ${name}: ${url}`);

  await page.goto(url, {
    waitUntil: "networkidle",
    timeout: 60000
  });

  await page.screenshot({
    path: path.join(output, `${name}.png`),
    fullPage
  });
}

// ----------------------------------------------------------
// PUBLIC HOME
// ----------------------------------------------------------

await capture(
  "01-home",
  `${site}/`
);

// ----------------------------------------------------------
// LOGIN
// ----------------------------------------------------------

await capture(
  "02-login",
  `${site}/login`
);

// ----------------------------------------------------------
// AUTHENTICATE
// ----------------------------------------------------------

await page.goto(`${site}/login`, {
  waitUntil: "networkidle"
});

await page.locator('input[name="username"]').fill(user);
await page.locator('input[name="password"]').fill(pass);

await Promise.all([
  page.waitForLoadState("networkidle"),
  page.locator('button[type="submit"], button.primary').first().click()
]);

// ----------------------------------------------------------
// ADMIN
// ----------------------------------------------------------

await capture(
  "03-admin-dashboard",
  `${site}/admin`
);

// ----------------------------------------------------------
// INVITES
// ----------------------------------------------------------

await capture(
  "04-invite-manager",
  `${site}/admin/invites`
);

// ----------------------------------------------------------
// CURRICULUM
// ----------------------------------------------------------

await capture(
  "05-curriculum",
  `${site}/curriculum`
);

// ----------------------------------------------------------
// REFERENCE LIBRARY
// ----------------------------------------------------------

await capture(
  "06-reference-library",
  `${site}/reference`
);

// ----------------------------------------------------------
// FIRST LESSON
// ----------------------------------------------------------

await page.goto(`${site}/curriculum`, {
  waitUntil: "networkidle"
});

const lessonHref = await page
  .locator('a[href^="/lesson/"]')
  .first()
  .getAttribute("href")
  .catch(() => null);

if (lessonHref) {
  await capture(
    "07-lesson",
    `${site}${lessonHref}`
  );
}

// ----------------------------------------------------------
// SUBJECT DASHBOARD
// ----------------------------------------------------------

await page.goto(`${site}/`, {
  waitUntil: "networkidle"
});

const subjectHref = await page
  .locator('a[href^="/subject/"]')
  .first()
  .getAttribute("href")
  .catch(() => null);

if (subjectHref) {
  await capture(
    "08-subject-dashboard",
    `${site}${subjectHref}`
  );
}

await browser.close();

console.log("Screenshot capture complete.");
