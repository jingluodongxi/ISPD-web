/* Run with: node tests/browser.test.js workbook.xlsx [screenshot.png] */
const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

(async () => {
  const workbookPath = process.argv[2];
  const screenshotPath = process.argv[3];
  if (!workbookPath) throw new Error("Please provide a workbook path.");

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || undefined
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);
  await page.setInputFiles("#file-input", workbookPath);
  await page.waitForFunction(() => document.querySelectorAll("#file-list li").length === 1);
  await page.click("#btn-compute");
  await page.waitForFunction(() => document.querySelectorAll("#result-tbody tr").length === 1);

  const status = await page.textContent("#status-bar");
  assert.match(status, /分析成功/);
  assert.strictEqual(await page.$eval("#chart2-canvas", (el) => el.style.display), "block");

  await page.click('.tab-btn[data-tab="2"]');
  const cells = await page.$$eval("#result-tbody tr:first-child td", (items) =>
    items.map((item) => item.textContent)
  );
  assert.strictEqual(cells[1], "90.00");
  assert.strictEqual(cells[4], "0.8091");
  assert.match(cells[6], /外推峰/);
  assert.strictEqual(browserErrors.length, 0, browserErrors.join("\n"));

  if (screenshotPath) {
    await page.click('.tab-btn[data-tab="1"]');
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  // Verify that several files can each keep their own first measured time.
  await page.check("#radio-single");
  await page.check("#radio-multi");
  const syntheticFiles = [15, 30, 90].map((firstTime) => {
    const rows = ["t/s,V"];
    for (let time = firstTime; time <= 1320; time += 10) {
      const voltage =
        1200 * Math.exp(-time / 40) +
        900 * Math.exp(-time / 280) +
        2200;
      rows.push(`${time},${voltage}`);
    }
    return {
      name: `start-${firstTime}s.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(rows.join("\n"), "utf8")
    };
  });
  await page.setInputFiles("#file-input", syntheticFiles);
  await page.waitForFunction(() => document.querySelectorAll("#file-list li").length === 3);
  await page.click("#btn-compute");
  await page.waitForFunction(() => document.querySelectorAll("#result-tbody tr").length === 3);
  const multiFileResults = await page.evaluate(() =>
    allResults.map((result) => ({
      tFirst: result.tFirst,
      displayStart: result.displayStart,
      extrapolatedPoints: result.EExtrapolated.length
    })).sort((a, b) => a.tFirst - b.tFirst)
  );
  assert.deepStrictEqual(
    multiFileResults.map((result) => result.tFirst),
    [15, 30, 90]
  );
  multiFileResults.forEach((result) => {
    assert.strictEqual(result.displayStart, 5);
    assert.ok(result.extrapolatedPoints > 0);
  });
  assert.strictEqual(browserErrors.length, 0, browserErrors.join("\n"));

  await browser.close();
  console.log("Browser workflow test passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
