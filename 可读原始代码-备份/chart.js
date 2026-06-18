// Canvas-based chart rendering (replaces matplotlib)
var ChartRenderer = (function() {
'use strict';

function drawVtChart(canvas, seriesData, colors) {
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.parentElement.getBoundingClientRect();
  var W = (rect.width > 100) ? rect.width : 900;
  canvas.width = W * dpr;
  canvas.height = 600 * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = '600px';
  ctx.scale(dpr, dpr);

  var margin = { top: 50, right: 40, bottom: 70, left: 80 };
  var pw = W - margin.left - margin.right;
  var ph = 600 - margin.top - margin.bottom;

  var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  seriesData.forEach(function(s) {
    s.tLog.forEach(function(x) { xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); });
    s.vRaw.forEach(function(y) { if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); } });
    s.tLogDense.forEach(function(x) { if (isFinite(x)) { xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); } });
    s.vDense.forEach(function(y) { if (isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); } });
  });
  if (!isFinite(xMin) || !isFinite(xMax)) { xMin = 0; xMax = 5; }
  if (!isFinite(yMin) || !isFinite(yMax)) { yMin = 0; yMax = 100; }
  var xPad = (xMax - xMin) * 0.05 || 0.5;
  var yPad = (yMax - yMin) * 0.08 || 1;
  xMin -= xPad; xMax += xPad; yMin -= yPad; yMax += yPad;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, 600);

  function toX(x) { return margin.left + (x - xMin) / (xMax - xMin) * pw; }
  function toY(y) { return margin.top + ph - (y - yMin) / (yMax - yMin) * ph; }

  // Grid
  ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 0.5;
  var xSteps = 5, ySteps = 5;
  for (var i = 0; i <= xSteps; i++) {
    var xv = xMin + (xMax - xMin) * i / xSteps;
    ctx.beginPath(); ctx.moveTo(toX(xv), margin.top); ctx.lineTo(toX(xv), margin.top + ph); ctx.stroke();
  }
  for (var j = 0; j <= ySteps; j++) {
    var yv = yMin + (yMax - yMin) * j / ySteps;
    ctx.beginPath(); ctx.moveTo(margin.left, toY(yv)); ctx.lineTo(margin.left + pw, toY(yv)); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + ph); ctx.lineTo(margin.left + pw, margin.top + ph); ctx.stroke();

  // Plot scatter points and fitted curves
  seriesData.forEach(function(s, i) {
    var c = colors[i % colors.length];
    for (var k = 0; k < s.tLog.length; k++) {
      ctx.fillStyle = c; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(toX(s.tLog[k]), toY(s.vRaw[k]), 3, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath();
    var first = true;
    for (var k = 0; k < s.tLogDense.length; k++) {
      var px = toX(s.tLogDense[k]), py = toY(s.vDense[k]);
      if (!isFinite(px) || !isFinite(py)) { continue; }
      if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
    }
    ctx.stroke();
  });

  // Axis labels
  ctx.fillStyle = '#333'; ctx.textAlign = 'center';
  ctx.font = 'bold 13px "Microsoft YaHei", "SimHei", sans-serif';
  for (var i = 0; i <= xSteps; i++) {
    var xv = xMin + (xMax - xMin) * i / xSteps;
    ctx.fillText(xv.toFixed(1), toX(xv), margin.top + ph + 20);
  }
  ctx.font = 'bold 14px "Microsoft YaHei", "SimHei", sans-serif';
  ctx.fillText('对数时间 log\u2081\u2080(t)', margin.left + pw / 2, margin.top + ph + 55);

  ctx.textAlign = 'right';
  ctx.font = 'bold 13px "Microsoft YaHei", "SimHei", sans-serif';
  for (var j = 0; j <= ySteps; j++) {
    var yv = yMin + (yMax - yMin) * j / ySteps;
    ctx.fillText(yv.toFixed(2), margin.left - 10, toY(yv) + 5);
  }
  ctx.save(); ctx.translate(15, margin.top + ph / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px "Microsoft YaHei", "SimHei", sans-serif';
  ctx.fillText('表面电位 V (V)', 0, 0);
  ctx.restore();

  // Title
  ctx.textAlign = 'center'; ctx.font = 'bold 16px "Microsoft YaHei", "SimHei", sans-serif';
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText('表面电位衰减动力学分析', margin.left + pw / 2, margin.top - 15);

  // Legend
  ctx.textAlign = 'left'; ctx.font = '12px "Microsoft YaHei", "SimHei", sans-serif';
  var ly = margin.top + 5;
  seriesData.forEach(function(s, i) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(margin.left + pw - 280, ly, 15, 15);
    ctx.fillStyle = '#333';
    ctx.fillText(s.label || ('数据' + (i + 1)), margin.left + pw - 260, ly + 12);
    ly += 22;
  });

  return canvas;
}

// Et-Nt Chart
function drawEtNtChart(canvas, seriesData, colors) {
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.parentElement.getBoundingClientRect();
  var W = (rect.width > 100) ? rect.width : 900;
  canvas.width = W * dpr;
  canvas.height = 600 * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = '600px';
  ctx.scale(dpr, dpr);

  var margin = { top: 50, right: 40, bottom: 70, left: 90 };
  var pw = W - margin.left - margin.right;
  var ph = 600 - margin.top - margin.bottom;

  var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  seriesData.forEach(function(s) {
    s.E_t.forEach(function(x) { if (isFinite(x) && x >= 0 && x <= 2) { xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); } });
    s.N_t.forEach(function(y) { if (isFinite(y) && y >= 0) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); } });
  });
  if (!isFinite(xMin)) { xMin = 0; xMax = 2; }
  if (!isFinite(yMin)) { yMin = 0; yMax = 1e15; }
  var xPad = (xMax - xMin) * 0.05 || 0.1;
  var yPad = (yMax - yMin) * 0.1 || 1e13;
  xMin = Math.max(0, xMin - xPad); xMax += xPad;
  yMin = Math.max(0, yMin - yPad); yMax += yPad;

  function toX(x) { return margin.left + (x - xMin) / (xMax - xMin) * pw; }
  function toY(y) { return margin.top + ph - (y - yMin) / (yMax - yMin) * ph; }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, 600);

  // Grid
  ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 0.5;
  var xSteps = 5, ySteps = 5;
  for (var i = 0; i <= xSteps; i++) {
    var xv = xMin + (xMax - xMin) * i / xSteps;
    ctx.beginPath(); ctx.moveTo(toX(xv), margin.top); ctx.lineTo(toX(xv), margin.top + ph); ctx.stroke();
  }
  for (var j = 0; j <= ySteps; j++) {
    var yv = yMin + (yMax - yMin) * j / ySteps;
    ctx.beginPath(); ctx.moveTo(margin.left, toY(yv)); ctx.lineTo(margin.left + pw, toY(yv)); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + ph); ctx.lineTo(margin.left + pw, margin.top + ph); ctx.stroke();

  // Plot curves and star markers
  seriesData.forEach(function(s, i) {
    var c = colors[i % colors.length];
    ctx.strokeStyle = c; ctx.lineWidth = 2.5;
    ctx.beginPath();
    var first = true;
    for (var k = 0; k < s.E_t.length; k++) {
      if (s.E_t[k] < xMin || s.E_t[k] > xMax) continue;
      var py = toY(s.N_t[k]);
      if (isFinite(py) && py > margin.top && py < margin.top + ph) {
        var px = toX(s.E_t[k]);
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // Star marker for shallow trap
    if (s.shallow_E != null) drawStar(ctx, toX(s.shallow_E), toY(s.shallow_N), c);
    // Star marker for deep trap
    if (s.deep_E != null) drawStar(ctx, toX(s.deep_E), toY(s.deep_N), c);
  });

  // Axis labels
  ctx.fillStyle = '#333'; ctx.textAlign = 'center';
  ctx.font = 'bold 13px "Microsoft YaHei", "SimHei", sans-serif';
  for (var i = 0; i <= xSteps; i++) {
    var xv = xMin + (xMax - xMin) * i / xSteps;
    ctx.fillText(xv.toFixed(2), toX(xv), margin.top + ph + 20);
  }
  ctx.font = 'bold 14px "Microsoft YaHei", "SimHei", sans-serif';
  ctx.fillText('陷阱能级深度 E\u209C (eV)', margin.left + pw / 2, margin.top + ph + 55);

  ctx.textAlign = 'right';
  ctx.font = 'bold 13px "Microsoft YaHei", "SimHei", sans-serif';
  for (var j = 0; j <= ySteps; j++) {
    var yv = yMin + (yMax - yMin) * j / ySteps;
    ctx.fillText(yv.toExponential(1), margin.left - 10, toY(yv) + 5);
  }
  ctx.save(); ctx.translate(15, margin.top + ph / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px "Microsoft YaHei", "SimHei", sans-serif';
  ctx.fillText('面陷阱密度 N\u209B\u209C (eV\u207B\u00B9m\u207B\u00B2)', 0, 0);
  ctx.restore();

  // Title
  ctx.fillStyle = '#1a1a2e'; ctx.textAlign = 'center';
  ctx.font = 'bold 16px "Microsoft YaHei", "SimHei", sans-serif';
  ctx.fillText('聚合物面陷阱能级分布 (Surface Trap Density)', margin.left + pw / 2, margin.top - 15);

  // Legend
  ctx.textAlign = 'left'; ctx.font = '12px "Microsoft YaHei", "SimHei", sans-serif';
  var ly = margin.top + 5;
  seriesData.forEach(function(s, i) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(margin.left + pw - 280, ly, 15, 15);
    ctx.fillStyle = '#333';
    ctx.fillText(s.label || ('数据' + (i + 1)), margin.left + pw - 260, ly + 12);
    ly += 22;
  });

  return canvas;
}

function drawStar(ctx, cx, cy, color) {
  var spikes = 5, outerR = 10, innerR = 4;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (var i = 0; i < spikes * 2; i++) {
    var r = (i % 2 === 0) ? outerR : innerR;
    var angle = 3 * Math.PI / 2 + 2 * Math.PI * i / (spikes * 2);
    var x = cx + Math.cos(angle) * r;
    var y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

return {
  drawVtChart: drawVtChart,
  drawEtNtChart: drawEtNtChart
};

})();
