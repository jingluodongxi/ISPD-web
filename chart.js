var ChartRenderer = (function() {
  "use strict";

  // Draw star marker for peak positions
  function drawStar(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? 12 : 5;
      var angle = -Math.PI / 2 + (2 * Math.PI * i) / 10;
      var px = x + Math.cos(angle) * r;
      var py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  return {
    // ===== V-t Chart (Surface Potential Decay) =====
    drawVtChart: function(canvas, datasets, colors) {
      var ctx = canvas.getContext("2d");
      var dpr = window.devicePixelRatio || 1;
      var rect = canvas.parentElement.getBoundingClientRect();
      var W = rect.width > 100 ? rect.width : 900;
      var H = 600;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.scale(dpr, dpr);

      var margin = { top: 55, right: 50, bottom: 80, left: 90 };
      var plotW = W - margin.left - margin.right;
      var plotH = H - margin.top - margin.bottom;

      // Compute data ranges
      var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      datasets.forEach(function(ds) {
        ds.tLog.forEach(function(v) { xMin = Math.min(xMin, v); xMax = Math.max(xMax, v); });
        ds.vRaw.forEach(function(v) { if (isFinite(v)) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); } });
        ds.tLogDense.forEach(function(v) { xMin = Math.min(xMin, v); xMax = Math.max(xMax, v); });
        ds.vDense.forEach(function(v) { if (isFinite(v)) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); } });
      });
      if (!isFinite(xMin)) { xMin = 0; xMax = 5; }
      if (!isFinite(yMin)) { yMin = 0; yMax = 100; }

      var xPad = 0.05 * (xMax - xMin) || 0.5;
      var yPad = 0.08 * (yMax - yMin) || 1;
      xMin -= xPad; xMax += xPad; yMin -= yPad; yMax += yPad;

      function toX(x) { return margin.left + (x - xMin) / (xMax - xMin) * plotW; }
      function toY(y) { return margin.top + plotH - (y - yMin) / (yMax - yMin) * plotH; }

      // Background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 0.5;
      for (var i = 0; i <= 5; i++) {
        var gx = xMin + (xMax - xMin) * i / 5;
        ctx.beginPath(); ctx.moveTo(toX(gx), margin.top); ctx.lineTo(toX(gx), margin.top + plotH); ctx.stroke();
      }
      for (var j = 0; j <= 5; j++) {
        var gy = yMin + (yMax - yMin) * j / 5;
        ctx.beginPath(); ctx.moveTo(margin.left, toY(gy)); ctx.lineTo(margin.left + plotW, toY(gy)); ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(margin.left, margin.top);
      ctx.lineTo(margin.left, margin.top + plotH);
      ctx.lineTo(margin.left + plotW, margin.top + plotH);
      ctx.stroke();

      // Data points and fit curves
      datasets.forEach(function(ds, idx) {
        var color = colors[idx % colors.length];
        // Scatter points
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        for (var i = 0; i < ds.tLog.length; i++) {
          ctx.beginPath();
          ctx.arc(toX(ds.tLog[i]), toY(ds.vRaw[i]), 4, 0, 2 * Math.PI);
          ctx.fill();
        }
        // Fit curve
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        var started = false;
        for (var i = 0; i < ds.tLogDense.length; i++) {
          var px = toX(ds.tLogDense[i]), py = toY(ds.vDense[i]);
          if (isFinite(px) && isFinite(py)) {
            if (!started) { ctx.moveTo(px, py); started = true; }
            else ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      });

      // X-axis ticks
      ctx.fillStyle = "#333333";
      ctx.textAlign = "center";
      ctx.font = 'bold 14px "Microsoft YaHei", "SimHei", sans-serif';
      for (var i = 0; i <= 5; i++) {
        var vx = xMin + (xMax - xMin) * i / 5;
        ctx.fillText(vx.toFixed(1), toX(vx), margin.top + plotH + 25);
      }
      // X-axis title
      ctx.font = 'bold 16px "Microsoft YaHei", "SimHei", sans-serif';
      ctx.fillText("对数时间 log\u2081\u2080(t)", margin.left + plotW / 2, margin.top + plotH + 60);

      // Y-axis ticks
      ctx.textAlign = "right";
      ctx.font = 'bold 14px "Microsoft YaHei", "SimHei", sans-serif';
      for (var j = 0; j <= 5; j++) {
        var vy = yMin + (yMax - yMin) * j / 5;
        ctx.fillText(vy.toFixed(0), margin.left - 12, toY(vy) + 5);
      }
      // Y-axis title (rotated)
      ctx.save();
      ctx.translate(20, margin.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.font = 'bold 16px "Microsoft YaHei", "SimHei", sans-serif';
      ctx.fillText("表面电位 V (V)", 0, 0);
      ctx.restore();

      // Title
      ctx.textAlign = "center";
      ctx.font = 'bold 18px "Microsoft YaHei", "SimHei", sans-serif';
      ctx.fillStyle = "#1a1a2e";
      ctx.fillText("表面电位等温衰减动力学分析", margin.left + plotW / 2, margin.top - 22);

      // Legend
      ctx.textAlign = "left";
      ctx.font = '13px "Microsoft YaHei", "SimHei", sans-serif';
      var ly = margin.top + 5;
      datasets.forEach(function(ds, idx) {
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fillRect(margin.left + plotW - 280, ly, 16, 16);
        ctx.fillStyle = "#333333";
        ctx.fillText(ds.label || ("数据" + (idx + 1)), margin.left + plotW - 258, ly + 13);
        ly += 24;
      });
    },

    // ===== Et-Nt Chart (Trap Density Distribution) =====
    drawEtNtChart: function(canvas, datasets, colors) {
      var ctx = canvas.getContext("2d");
      var dpr = window.devicePixelRatio || 1;
      var rect = canvas.parentElement.getBoundingClientRect();
      var W = rect.width > 100 ? rect.width : 900;
      var H = 600;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.scale(dpr, dpr);

      var margin = { top: 55, right: 50, bottom: 80, left: 100 };
      var plotW = W - margin.left - margin.right;
      var plotH = H - margin.top - margin.bottom;

      // Compute data ranges
      var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      datasets.forEach(function(ds) {
        ds.E_t.forEach(function(v) {
          if (isFinite(v) && v >= 0) { xMin = Math.min(xMin, v); xMax = Math.max(xMax, v); }
        });
        ds.N_t.forEach(function(v) {
          if (isFinite(v) && v >= 0) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
        });
      });
      if (!isFinite(xMin)) { xMin = 0; xMax = 2; }
      if (!isFinite(yMin)) { yMin = 0; yMax = 1e15; }

      var xPad = 0.05 * (xMax - xMin) || 0.1;
      var yPad = 0.10 * (yMax - yMin) || 1e13;
      xMin = Math.max(0, xMin - xPad);
      xMax += xPad;
      yMin = Math.max(0, yMin - yPad);
      yMax += yPad;

      function toX(x) { return margin.left + (x - xMin) / (xMax - xMin) * plotW; }
      function toY(y) { return margin.top + plotH - (y - yMin) / (yMax - yMin) * plotH; }

      // Background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 0.5;
      for (var i = 0; i <= 5; i++) {
        var gx = xMin + (xMax - xMin) * i / 5;
        ctx.beginPath(); ctx.moveTo(toX(gx), margin.top); ctx.lineTo(toX(gx), margin.top + plotH); ctx.stroke();
      }
      for (var j = 0; j <= 5; j++) {
        var gy = yMin + (yMax - yMin) * j / 5;
        ctx.beginPath(); ctx.moveTo(margin.left, toY(gy)); ctx.lineTo(margin.left + plotW, toY(gy)); ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(margin.left, margin.top);
      ctx.lineTo(margin.left, margin.top + plotH);
      ctx.lineTo(margin.left + plotW, margin.top + plotH);
      ctx.stroke();

      // N_t curves and star markers
      datasets.forEach(function(ds, idx) {
        var color = colors[idx % colors.length];
        // Curve
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        var started = false;
        for (var i = 0; i < ds.E_t.length; i++) {
          if (ds.E_t[i] < xMin || ds.E_t[i] > xMax) continue;
          var py = toY(ds.N_t[i]);
          if (!isFinite(py) || py < margin.top || py > margin.top + plotH) continue;
          var px = toX(ds.E_t[i]);
          if (!started) { ctx.moveTo(px, py); started = true; }
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Peak stars
        if (ds.shallow_E != null) drawStar(ctx, toX(ds.shallow_E), toY(ds.shallow_N), color);
        if (ds.deep_E != null) drawStar(ctx, toX(ds.deep_E), toY(ds.deep_N), color);
      });

      // X-axis ticks
      ctx.fillStyle = "#333333";
      ctx.textAlign = "center";
      ctx.font = 'bold 14px "Microsoft YaHei", "SimHei", sans-serif';
      for (var i = 0; i <= 5; i++) {
        var vx = xMin + (xMax - xMin) * i / 5;
        ctx.fillText(vx.toFixed(2), toX(vx), margin.top + plotH + 25);
      }
      // X-axis title
      ctx.font = 'bold 16px "Microsoft YaHei", "SimHei", sans-serif';
      ctx.fillText("陷阱能级深度 E\u209C (eV)", margin.left + plotW / 2, margin.top + plotH + 60);

      // Y-axis ticks
      ctx.textAlign = "right";
      ctx.font = 'bold 14px "Microsoft YaHei", "SimHei", sans-serif';
      for (var j = 0; j <= 5; j++) {
        var vy = yMin + (yMax - yMin) * j / 5;
        ctx.fillText(vy.toExponential(1), margin.left - 12, toY(vy) + 5);
      }
      // Y-axis title (rotated)
      ctx.save();
      ctx.translate(18, margin.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.font = 'bold 16px "Microsoft YaHei", "SimHei", sans-serif';
      ctx.fillText("面陷阱密度 N\u209C (eV\u207B\u00B9\u00B7m\u207B\u00B2)", 0, 0);
      ctx.restore();

      // Title
      ctx.textAlign = "center";
      ctx.font = 'bold 18px "Microsoft YaHei", "SimHei", sans-serif';
      ctx.fillStyle = "#1a1a2e";
      ctx.fillText("聚合物面陷阱能级分布 (Surface Trap Density)", margin.left + plotW / 2, margin.top - 22);

      // Legend
      ctx.textAlign = "left";
      ctx.font = '13px "Microsoft YaHei", "SimHei", sans-serif';
      var ly = margin.top + 5;
      datasets.forEach(function(ds, idx) {
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fillRect(margin.left + 10, ly, 16, 16);
        ctx.fillStyle = "#333333";
        ctx.fillText(ds.label || ("数据" + (idx + 1)), margin.left + 32, ly + 13);
        ly += 24;
      });
    }
  };
})();
