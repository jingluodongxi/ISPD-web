/* Run with: node tests/browser.test.js workbook.xlsx [screenshot.png] */
const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

(async () => {
  const workbookPath = process.argv[2];
  const screenshotPath = process.argv[3];
  const pdfPath = process.argv[4];
  const svgPath = process.argv[5];
  const workbookName = path.basename(workbookPath || "");
  if (!workbookPath) throw new Error("Please provide a workbook path.");

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || undefined
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);
  await page.click("#tbtn-svg1");
  assert.match(await page.textContent("#status-bar"), /没有可导出的图形/);
  await page.setInputFiles("#file-input", workbookPath);
  await page.waitForFunction(() => document.querySelectorAll("#file-list li").length === 1);
  await page.click("#btn-compute");
  await page.waitForFunction(() => document.querySelectorAll("#result-tbody tr").length === 1);

  const status = await page.textContent("#status-bar");
  assert.match(status, /分析成功/);
  assert.strictEqual(await page.$eval("#chart2-canvas", (el) => el.style.display), "block");

  // SVG exports must consist of editable vector elements and text, never a raster screenshot.
  const vectorExports = await page.evaluate(() => ({
    vt: ChartRenderer.exportVtSvg(currentVtDatasets, currentChartColors),
    trap: ChartRenderer.exportEtNtSvg(currentTrapDatasets, currentChartColors)
  }));
  [vectorExports.vt, vectorExports.trap].forEach((svg) => {
    assert.match(svg, /viewBox="0 0 1200 800"/);
    assert.match(svg, /<text[^>]*>/);
    assert.match(svg, /<polyline/);
    assert.doesNotMatch(svg, /<image\b/i);
    assert.doesNotMatch(svg, /data:image\/(png|jpeg|jpg)/i);
  });
  assert.match(vectorExports.trap, /stroke-dasharray=/);
  assert.match(vectorExports.trap, /<polygon/);

  const pngDownloadPromise = page.waitForEvent("download");
  await page.click("#tbtn-png2");
  const pngDownload = await pngDownloadPromise;
  assert.strictEqual(pngDownload.suggestedFilename(), "ISPD_EtNt_Chart.png");

  const downloadPromise = page.waitForEvent("download");
  await page.click("#tbtn-svg2");
  const svgDownload = await downloadPromise;
  assert.strictEqual(svgDownload.suggestedFilename(), "ISPD_EtNt_Chart.svg");
  if (svgPath) await svgDownload.saveAs(svgPath);

  const popupPromise = page.waitForEvent("popup");
  await page.click("#tbtn-pdf2");
  const printPage = await popupPromise;
  await printPage.waitForLoadState("domcontentloaded");
  assert.strictEqual(await printPage.locator("svg").count(), 1);
  assert.strictEqual(await printPage.locator("canvas").count(), 0);
  assert.strictEqual(await printPage.locator("img").count(), 0);
  assert.match(await printPage.title(), /ISPD_EtNt_Chart/);
  if (pdfPath) {
    await printPage.pdf({
      path: pdfPath,
      width: "180mm",
      height: "120mm",
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      printBackground: true
    });
  }
  await printPage.close();

  await page.click('.tab-btn[data-tab="0"]');
  const vtDownloadPromise = page.waitForEvent("download");
  await page.click("#tbtn-svg1");
  const vtSvgDownload = await vtDownloadPromise;
  assert.strictEqual(vtSvgDownload.suggestedFilename(), "ISPD_Vt_Chart.svg");

  const vtPopupPromise = page.waitForEvent("popup");
  await page.click("#tbtn-pdf1");
  const vtPrintPage = await vtPopupPromise;
  await vtPrintPage.waitForLoadState("domcontentloaded");
  assert.strictEqual(await vtPrintPage.locator("svg").count(), 1);
  assert.strictEqual(await vtPrintPage.locator("canvas").count(), 0);
  assert.strictEqual(await vtPrintPage.locator("img").count(), 0);
  assert.match(await vtPrintPage.title(), /ISPD_Vt_Chart/);
  await vtPrintPage.close();

  await page.click('.tab-btn[data-tab="2"]');
  const cells = await page.$$eval("#result-tbody tr:first-child td", (items) =>
    items.map((item) => item.textContent)
  );
  assert.strictEqual(cells[1], "90.00");
  if (workbookName.includes("75s")) {
    assert.strictEqual(cells[7], "0.9337");
    assert.match(cells[9], /末点后外推/);
    const connection = await page.evaluate(() => {
      const result = allResults[0];
      return {
        curveStartE: result.EPostExtrapolated[0],
        curveEndE: result.EPostExtrapolated.at(-1),
        peakE: result.deep_E,
        displayEnd: result.displayEnd,
        tau: result.tau2
      };
    });
    assert.ok(connection.curveStartE < connection.peakE);
    assert.ok(connection.peakE < connection.curveEndE);
    assert.ok(connection.displayEnd >= 5 * connection.tau);
  } else if (workbookName.includes("120s")) {
    assert.strictEqual(cells[4], "0.7143");
    assert.match(cells[6], /首点前外推/);
    assert.match(cells[6], /参数边界/);
    const connection = await page.evaluate(() => {
      const result = allResults[0];
      return {
        curveStartE: result.EPreExtrapolated[0],
        curveEndE: result.EPreExtrapolated.at(-1),
        peakE: result.shallow_E,
        displayStart: result.displayStart
      };
    });
    assert.strictEqual(connection.displayStart, 0.1);
    assert.ok(connection.curveStartE < connection.peakE);
    assert.ok(connection.peakE < connection.curveEndE);
  } else if (workbookName.includes("180s")) {
    assert.strictEqual(cells[4], "0.8091");
    assert.match(cells[6], /首点前外推/);
  }
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
      preExtrapolatedPoints: result.EPreExtrapolated.length,
      postExtrapolatedPoints: result.EPostExtrapolated.length
    })).sort((a, b) => a.tFirst - b.tFirst)
  );
  assert.deepStrictEqual(
    multiFileResults.map((result) => result.tFirst),
    [15, 30, 90]
  );
  multiFileResults.forEach((result) => {
    assert.ok(result.displayStart >= 0.1 && result.displayStart < 5);
    assert.ok(result.preExtrapolatedPoints > 0);
    assert.ok(result.postExtrapolatedPoints > 0);
  });
  assert.strictEqual(browserErrors.length, 0, browserErrors.join("\n"));

  await browser.close();
  console.log("Browser workflow test passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
