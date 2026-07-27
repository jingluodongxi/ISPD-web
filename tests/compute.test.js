/* Run with: node tests/compute.test.js [optional-workbook.xlsx] */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function loadBrowserScript(filename) {
  vm.runInThisContext(fs.readFileSync(path.join(root, filename), "utf8"), {
    filename: filename
  });
}

loadBrowserScript("lmfit.js");
loadBrowserScript("compute.js");

function syntheticSeries(firstTime) {
  const t = [];
  const v = [];
  for (let time = firstTime; time <= 1320; time += 10) {
    t.push(time);
    v.push(
      1200 * Math.exp(-time / 40) +
      900 * Math.exp(-time / 280) +
      2200
    );
  }
  return { t, v };
}

[15, 30, 90].forEach((firstTime) => {
  const source = syntheticSeries(firstTime);
  const result = ISPD.compute(source.t, source.v, 300, 1e12, 3, 50);
  assert.strictEqual(result.tFirst, firstTime);
  assert.ok(Math.abs(
    result.displayStart -
    Math.max(0.1, Math.min(5, Math.min(result.tau1, result.tau2) / 100))
  ) < 1e-12);
  assert.ok(Math.abs(
    result.displayEnd -
    Math.max(result.tLast, 5 * Math.max(result.tau1, result.tau2))
  ) < 1e-9);
  assert.ok(result.EPreExtrapolated.length > 0);
  assert.ok(result.EPostExtrapolated.length > 0);
  assert.ok(result.EMeasured.length > 0);
  assert.ok(Math.abs(result.tDense[0] - firstTime) < 1e-9);
  assert.ok(Math.abs(result.shallow_E - 8.617e-5 * 300 * Math.log(1e12 * result.tau1)) < 1e-12);
  const expectedRegion = result.tau1 < firstTime ? "before" :
    result.tau1 > result.tLast ? "after" : "measured";
  assert.strictEqual(result.shallow_peak_region, expectedRegion);
});

const early = syntheticSeries(3);
const earlyResult = ISPD.compute(early.t, early.v, 300, 1e12, 3, 50);
assert.ok(earlyResult.displayStart >= 0.1 && earlyResult.displayStart < 3);
assert.ok(earlyResult.EPreExtrapolated.length > 0);

[
  { t: [0, 10, 20], message: /大于 0/ },
  { t: [-1, 10, 20], message: /大于 0/ },
  { t: [10, 10, 20], message: /严格递增/ },
  { t: [10, 30, 20], message: /严格递增/ }
].forEach((testCase) => {
  assert.throws(
    () => ISPD.compute(testCase.t, [3, 2, 1], 300, 1e12, 3, 50),
    testCase.message
  );
});

const workbookPaths = process.argv.slice(2);
if (workbookPaths.length > 0) loadBrowserScript("xlsx.full.min.js");
workbookPaths.forEach((workbookPath) => {
  const workbook = XLSX.read(fs.readFileSync(workbookPath), { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const t = [];
  const v = [];
  rows.forEach((row) => {
    const time = parseFloat(row[0]);
    const voltage = parseFloat(row[1]);
    if (Number.isFinite(time) && Number.isFinite(voltage)) {
      t.push(time);
      v.push(voltage);
    }
  });
  const result = ISPD.compute(t, v, 300, 1e12, 3, 50);
  const filename = path.basename(workbookPath);
  assert.strictEqual(result.tFirst, 90);

  if (filename.includes("75s")) {
    assert.ok(result.deep_E > 0.93 && result.deep_E < 0.94);
    assert.strictEqual(result.deep_peak_region, "after");
    assert.ok(result.EPostExtrapolated.length > 0);
    assert.ok(result.EPostExtrapolated[0] < result.deep_E);
    assert.ok(result.deep_E < result.EPostExtrapolated.at(-1));
    assert.ok(result.displayEnd >= 5 * result.tau2);
    assert.strictEqual(result.deep_boundary_warning, true);
  } else if (filename.includes("120s")) {
    assert.ok(result.shallow_E > 0.71 && result.shallow_E < 0.72);
    assert.strictEqual(result.shallow_peak_region, "before");
    assert.strictEqual(result.displayStart, 0.1);
    assert.ok(result.EPreExtrapolated[0] < result.shallow_E);
    assert.ok(result.shallow_E < result.EPreExtrapolated.at(-1));
    assert.strictEqual(result.shallow_boundary_warning, true);
  } else if (filename.includes("180s")) {
    assert.ok(result.shallow_E > 0.80 && result.shallow_E < 0.82);
    assert.strictEqual(result.shallow_peak_region, "before");
    assert.strictEqual(result.deep_peak_region, "measured");
    assert.ok(result.EPreExtrapolated[0] < result.shallow_E);
    assert.ok(result.shallow_E < result.EPreExtrapolated.at(-1));
    assert.ok(result.displayEnd > result.tLast);
  }

  console.log(
    "Workbook verified:",
    JSON.stringify({
      filename,
      tFirst: result.tFirst,
      shallow_E: result.shallow_E,
      shallowPeak: result.shallow_peak_region,
      deep_E: result.deep_E,
      deepPeak: result.deep_peak_region,
      r2: result.r2
    })
  );
});

console.log("All ISPD compute tests passed.");
