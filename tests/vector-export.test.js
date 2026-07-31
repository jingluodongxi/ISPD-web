/* Run with: node tests/vector-export.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
vm.runInThisContext(fs.readFileSync(path.join(root, "chart.js"), "utf8"), {
  filename: "chart.js"
});

const colors = ["#005FB8"];
const vtDatasets = [{
  tLog: [1, 2, 3],
  vRaw: [3000, 2600, 2400],
  tLogDense: [1, 1.5, 2, 2.5, 3],
  vDense: [3000, 2750, 2570, 2470, 2400],
  label: "中文样品.xlsx (R²=0.9987)"
}];
const trapDatasets = [{
  EPreExtrapolated: [0.70, 0.74, 0.78],
  NPreExtrapolated: [1e13, 2e14, 4e14],
  EMeasured: [0.78, 0.82, 0.86],
  NMeasured: [4e14, 7e14, 3e14],
  EPostExtrapolated: [0.86, 0.90, 0.94],
  NPostExtrapolated: [3e14, 8e14, 2e14],
  shallow_E: 0.80,
  shallow_N: 5e14,
  deep_E: 0.90,
  deep_N: 8e14,
  label: "中文样品.xlsx"
}];

function verifyCommonSvg(svg, expectedText) {
  assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(svg, /width="1200" height="800"/);
  assert.match(svg, /viewBox="0 0 1200 800"/);
  assert.match(svg, /<clipPath id="plot-clip">/);
  assert.match(svg, /<polyline/);
  assert.match(svg, /<text[^>]*>/);
  assert.ok(svg.includes(expectedText));
  assert.doesNotMatch(svg, /<image\b/i);
  assert.doesNotMatch(svg, /data:image\/(png|jpeg|jpg)/i);
}

const vtSvg = ChartRenderer.exportVtSvg(vtDatasets, colors);
verifyCommonSvg(vtSvg, "表面电位等温衰减动力学分析");
assert.ok(vtSvg.includes("中文样品.xlsx"));
assert.match(vtSvg, /<circle[^>]*clip-path="url\(#plot-clip\)"/);

const trapSvg = ChartRenderer.exportEtNtSvg(trapDatasets, colors);
verifyCommonSvg(trapSvg, "聚合物面陷阱能级分布");
assert.ok(trapSvg.includes("实线：实际测量时间范围内拟合"));
assert.match(trapSvg, /stroke-dasharray=/);
assert.match(trapSvg, /<polygon[^>]*clip-path="url\(#plot-clip\)"/);
assert.ok((trapSvg.match(/<polygon/g) || []).length >= 2);

const customSvg = ChartRenderer.exportEtNtSvg(trapDatasets, colors, { width: 900, height: 600 });
assert.match(customSvg, /width="900" height="600"/);
assert.match(customSvg, /viewBox="0 0 900 600"/);

console.log("Vector SVG export tests passed.");
