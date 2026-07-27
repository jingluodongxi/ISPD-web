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
  assert.strictEqual(result.displayStart, 5);
  assert.ok(result.EExtrapolated.length > 0);
  assert.ok(result.EMeasured.length > 0);
  assert.ok(Math.abs(result.tDense[0] - firstTime) < 1e-9);
  assert.ok(Math.abs(result.shallow_E - 8.617e-5 * 300 * Math.log(1e12 * result.tau1)) < 1e-12);
  assert.strictEqual(result.shallow_extrapolated, result.tau1 < firstTime);
});

const early = syntheticSeries(3);
const earlyResult = ISPD.compute(early.t, early.v, 300, 1e12, 3, 50);
assert.strictEqual(earlyResult.displayStart, 3);
assert.strictEqual(earlyResult.EExtrapolated.length, 0);

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

const workbookPath = process.argv[2];
if (workbookPath) {
  loadBrowserScript("xlsx.full.min.js");
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
  assert.strictEqual(result.tFirst, 90);
  assert.ok(result.shallow_E > 0.80 && result.shallow_E < 0.82);
  assert.strictEqual(result.shallow_extrapolated, true);
  console.log(
    "Workbook verified:",
    JSON.stringify({
      tFirst: result.tFirst,
      shallow_E: result.shallow_E,
      shallowPeak: result.shallow_extrapolated ? "extrapolated" : "measured",
      deep_E: result.deep_E,
      r2: result.r2
    })
  );
}

console.log("All ISPD compute tests passed.");
