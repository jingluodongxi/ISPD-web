var ChartRenderer = (function() {
  "use strict";

  var FONT_FAMILY = '"Microsoft YaHei", "SimHei", "Helvetica Neue", Arial, sans-serif';
  var EXPORT_WIDTH = 1200;
  var EXPORT_HEIGHT = 800;

  function finiteValues(values) {
    return (values || []).filter(function(value) { return isFinite(value); });
  }

  function scaleFor(width, height) {
    return Math.min(width / 900, height / 600);
  }

  function line(x1, y1, x2, y2, style) {
    return Object.assign({ type: "line", x1: x1, y1: y1, x2: x2, y2: y2 }, style || {});
  }

  function rect(x, y, width, height, style) {
    return Object.assign({ type: "rect", x: x, y: y, width: width, height: height }, style || {});
  }

  function circle(cx, cy, radius, style) {
    return Object.assign({ type: "circle", cx: cx, cy: cy, radius: radius }, style || {});
  }

  function polyline(points, style) {
    return Object.assign({ type: "polyline", points: points }, style || {});
  }

  function polygon(points, style) {
    return Object.assign({ type: "polygon", points: points }, style || {});
  }

  function textItem(text, x, y, style) {
    return Object.assign({ type: "text", text: text, x: x, y: y }, style || {});
  }

  function validPoints(xs, ys, toX, toY) {
    var points = [];
    var length = Math.min((xs || []).length, (ys || []).length);
    for (var i = 0; i < length; i++) {
      if (isFinite(xs[i]) && isFinite(ys[i])) {
        points.push([toX(xs[i]), toY(ys[i])]);
      }
    }
    return points;
  }

  function starPoints(x, y, outerRadius, innerRadius) {
    var points = [];
    for (var i = 0; i < 10; i++) {
      var radius = i % 2 === 0 ? outerRadius : innerRadius;
      var angle = -Math.PI / 2 + (2 * Math.PI * i) / 10;
      points.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
    }
    return points;
  }

  function baseScene(width, height, margin, title) {
    return {
      width: width,
      height: height,
      margin: margin,
      plotWidth: width - margin.left - margin.right,
      plotHeight: height - margin.top - margin.bottom,
      title: title,
      items: []
    };
  }

  function addGridAndAxes(scene, xMin, xMax, yMin, yMax, toX, toY, scale) {
    var margin = scene.margin;
    var plotWidth = scene.plotWidth;
    var plotHeight = scene.plotHeight;
    for (var i = 0; i <= 5; i++) {
      var gx = xMin + (xMax - xMin) * i / 5;
      scene.items.push(line(
        toX(gx), margin.top, toX(gx), margin.top + plotHeight,
        { stroke: "#E5E7EB", strokeWidth: 0.5 * scale }
      ));
    }
    for (var j = 0; j <= 5; j++) {
      var gy = yMin + (yMax - yMin) * j / 5;
      scene.items.push(line(
        margin.left, toY(gy), margin.left + plotWidth, toY(gy),
        { stroke: "#E5E7EB", strokeWidth: 0.5 * scale }
      ));
    }
    scene.items.push(polyline([
      [margin.left, margin.top],
      [margin.left, margin.top + plotHeight],
      [margin.left + plotWidth, margin.top + plotHeight],
      [margin.left + plotWidth, margin.top],
      [margin.left, margin.top]
    ], { fill: "none", stroke: "#333333", strokeWidth: 1.5 * scale }));
  }

  function createVtScene(datasets, colors, width, height) {
    var scale = scaleFor(width, height);
    var margin = {
      top: 55 * scale,
      right: 50 * scale,
      bottom: 80 * scale,
      left: 90 * scale
    };
    var scene = baseScene(width, height, margin, "表面电位等温衰减动力学分析");
    var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

    (datasets || []).forEach(function(dataset) {
      finiteValues(dataset.tLog).concat(finiteValues(dataset.tLogDense)).forEach(function(value) {
        xMin = Math.min(xMin, value);
        xMax = Math.max(xMax, value);
      });
      finiteValues(dataset.vRaw).concat(finiteValues(dataset.vDense)).forEach(function(value) {
        yMin = Math.min(yMin, value);
        yMax = Math.max(yMax, value);
      });
    });
    if (!isFinite(xMin)) { xMin = 0; xMax = 5; }
    if (!isFinite(yMin)) { yMin = 0; yMax = 100; }

    var xPad = 0.05 * (xMax - xMin) || 0.5;
    var yPad = 0.08 * (yMax - yMin) || 1;
    xMin -= xPad;
    xMax += xPad;
    yMin -= yPad;
    yMax += yPad;

    function toX(value) {
      return margin.left + (value - xMin) / (xMax - xMin) * scene.plotWidth;
    }
    function toY(value) {
      return margin.top + scene.plotHeight - (value - yMin) / (yMax - yMin) * scene.plotHeight;
    }

    scene.items.push(rect(0, 0, width, height, { fill: "#FFFFFF" }));
    addGridAndAxes(scene, xMin, xMax, yMin, yMax, toX, toY, scale);

    (datasets || []).forEach(function(dataset, datasetIndex) {
      var color = colors[datasetIndex % colors.length];
      var pointCount = Math.min((dataset.tLog || []).length, (dataset.vRaw || []).length);
      for (var i = 0; i < pointCount; i++) {
        if (isFinite(dataset.tLog[i]) && isFinite(dataset.vRaw[i])) {
          scene.items.push(circle(toX(dataset.tLog[i]), toY(dataset.vRaw[i]), 4 * scale, {
            fill: color,
            opacity: 0.5,
            clip: true
          }));
        }
      }
      var curvePoints = validPoints(dataset.tLogDense, dataset.vDense, toX, toY);
      if (curvePoints.length > 0) {
        scene.items.push(polyline(curvePoints, {
          fill: "none",
          stroke: color,
          strokeWidth: 2.5 * scale,
          clip: true
        }));
      }
    });

    var textColor = "#333333";
    for (var xi = 0; xi <= 5; xi++) {
      var vx = xMin + (xMax - xMin) * xi / 5;
      scene.items.push(textItem(vx.toFixed(1), toX(vx), margin.top + scene.plotHeight + 25 * scale, {
        fill: textColor, anchor: "middle", fontSize: 14 * scale, fontWeight: "bold"
      }));
    }
    scene.items.push(textItem("对数时间 log₁₀(t)", margin.left + scene.plotWidth / 2,
      margin.top + scene.plotHeight + 60 * scale, {
        fill: textColor, anchor: "middle", fontSize: 16 * scale, fontWeight: "bold"
      }));
    for (var yi = 0; yi <= 5; yi++) {
      var vy = yMin + (yMax - yMin) * yi / 5;
      scene.items.push(textItem(vy.toFixed(0), margin.left - 12 * scale, toY(vy) + 5 * scale, {
        fill: textColor, anchor: "end", fontSize: 14 * scale, fontWeight: "bold"
      }));
    }
    scene.items.push(textItem("表面电位 V (V)", 20 * scale, margin.top + scene.plotHeight / 2, {
      fill: textColor, anchor: "middle", fontSize: 16 * scale, fontWeight: "bold", rotate: -90
    }));
    scene.items.push(textItem(scene.title, margin.left + scene.plotWidth / 2, margin.top - 22 * scale, {
      fill: "#1a1a2e", anchor: "middle", fontSize: 18 * scale, fontWeight: "bold"
    }));

    var legendY = margin.top + 5 * scale;
    (datasets || []).forEach(function(dataset, datasetIndex) {
      var color = colors[datasetIndex % colors.length];
      scene.items.push(rect(margin.left + scene.plotWidth - 280 * scale, legendY, 16 * scale, 16 * scale, {
        fill: color
      }));
      scene.items.push(textItem(dataset.label || ("数据" + (datasetIndex + 1)),
        margin.left + scene.plotWidth - 258 * scale, legendY + 13 * scale, {
          fill: textColor, anchor: "start", fontSize: 13 * scale
        }));
      legendY += 24 * scale;
    });
    return scene;
  }

  function createEtNtScene(datasets, colors, width, height) {
    var scale = scaleFor(width, height);
    var margin = {
      top: 55 * scale,
      right: 50 * scale,
      bottom: 105 * scale,
      left: 100 * scale
    };
    var scene = baseScene(width, height, margin, "聚合物面陷阱能级分布 (Surface Trap Density)");
    var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

    (datasets || []).forEach(function(dataset) {
      var allE = (dataset.EPreExtrapolated || dataset.EExtrapolated || [])
        .concat(dataset.EMeasured || dataset.E_t || [], dataset.EPostExtrapolated || []);
      var allN = (dataset.NPreExtrapolated || dataset.NExtrapolated || [])
        .concat(dataset.NMeasured || dataset.N_t || [], dataset.NPostExtrapolated || []);
      allE.concat([dataset.shallow_E, dataset.deep_E]).forEach(function(value) {
        if (isFinite(value) && value >= 0) {
          xMin = Math.min(xMin, value);
          xMax = Math.max(xMax, value);
        }
      });
      allN.concat([dataset.shallow_N, dataset.deep_N]).forEach(function(value) {
        if (isFinite(value) && value >= 0) {
          yMin = Math.min(yMin, value);
          yMax = Math.max(yMax, value);
        }
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

    function toX(value) {
      return margin.left + (value - xMin) / (xMax - xMin) * scene.plotWidth;
    }
    function toY(value) {
      return margin.top + scene.plotHeight - (value - yMin) / (yMax - yMin) * scene.plotHeight;
    }

    scene.items.push(rect(0, 0, width, height, { fill: "#FFFFFF" }));
    addGridAndAxes(scene, xMin, xMax, yMin, yMax, toX, toY, scale);

    function addCurve(energies, densities, color, dashed) {
      var points = validPoints(energies, densities, toX, toY);
      if (points.length > 0) {
        scene.items.push(polyline(points, {
          fill: "none",
          stroke: color,
          strokeWidth: 2.5 * scale,
          dash: dashed ? [9 * scale, 6 * scale] : null,
          clip: true
        }));
      }
    }

    (datasets || []).forEach(function(dataset, datasetIndex) {
      var color = colors[datasetIndex % colors.length];
      addCurve(
        dataset.EPreExtrapolated || dataset.EExtrapolated || [],
        dataset.NPreExtrapolated || dataset.NExtrapolated || [],
        color,
        true
      );
      addCurve(dataset.EMeasured || dataset.E_t || [], dataset.NMeasured || dataset.N_t || [], color, false);
      addCurve(dataset.EPostExtrapolated || [], dataset.NPostExtrapolated || [], color, true);

      if (isFinite(dataset.shallow_E) && isFinite(dataset.shallow_N)) {
        scene.items.push(polygon(starPoints(
          toX(dataset.shallow_E), toY(dataset.shallow_N), 12 * scale, 5 * scale
        ), { fill: color, stroke: "#FFFFFF", strokeWidth: 1.5 * scale, clip: true }));
      }
      if (isFinite(dataset.deep_E) && isFinite(dataset.deep_N)) {
        scene.items.push(polygon(starPoints(
          toX(dataset.deep_E), toY(dataset.deep_N), 12 * scale, 5 * scale
        ), { fill: color, stroke: "#FFFFFF", strokeWidth: 1.5 * scale, clip: true }));
      }
    });

    var textColor = "#333333";
    for (var xi = 0; xi <= 5; xi++) {
      var vx = xMin + (xMax - xMin) * xi / 5;
      scene.items.push(textItem(vx.toFixed(2), toX(vx), margin.top + scene.plotHeight + 25 * scale, {
        fill: textColor, anchor: "middle", fontSize: 14 * scale, fontWeight: "bold"
      }));
    }
    scene.items.push(textItem("陷阱能级深度 Eₜ (eV)", margin.left + scene.plotWidth / 2,
      margin.top + scene.plotHeight + 60 * scale, {
        fill: textColor, anchor: "middle", fontSize: 16 * scale, fontWeight: "bold"
      }));
    scene.items.push(textItem(
      "实线：实际测量时间范围内拟合　　虚线：测量时间范围外的模型外推（不代表实测数据）",
      margin.left + scene.plotWidth / 2,
      margin.top + scene.plotHeight + 84 * scale,
      { fill: "#475569", anchor: "middle", fontSize: 12 * scale }
    ));
    for (var yi = 0; yi <= 5; yi++) {
      var vy = yMin + (yMax - yMin) * yi / 5;
      scene.items.push(textItem(vy.toExponential(1), margin.left - 12 * scale, toY(vy) + 5 * scale, {
        fill: textColor, anchor: "end", fontSize: 14 * scale, fontWeight: "bold"
      }));
    }
    scene.items.push(textItem("面陷阱密度 Nₜ (eV⁻¹·m⁻²)", 18 * scale, margin.top + scene.plotHeight / 2, {
      fill: textColor, anchor: "middle", fontSize: 16 * scale, fontWeight: "bold", rotate: -90
    }));
    scene.items.push(textItem(scene.title, margin.left + scene.plotWidth / 2, margin.top - 22 * scale, {
      fill: "#1a1a2e", anchor: "middle", fontSize: 18 * scale, fontWeight: "bold"
    }));

    var legendY = margin.top + 5 * scale;
    (datasets || []).forEach(function(dataset, datasetIndex) {
      var color = colors[datasetIndex % colors.length];
      scene.items.push(rect(margin.left + 10 * scale, legendY, 16 * scale, 16 * scale, { fill: color }));
      scene.items.push(textItem(dataset.label || ("数据" + (datasetIndex + 1)),
        margin.left + 32 * scale, legendY + 13 * scale, {
          fill: textColor, anchor: "start", fontSize: 13 * scale
        }));
      legendY += 24 * scale;
    });
    return scene;
  }

  function applyCanvasStyle(ctx, item) {
    ctx.globalAlpha = item.opacity == null ? 1 : item.opacity;
    ctx.fillStyle = item.fill || "transparent";
    ctx.strokeStyle = item.stroke || "transparent";
    ctx.lineWidth = item.strokeWidth || 1;
    ctx.setLineDash(item.dash || []);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }

  function renderCanvasItem(ctx, item) {
    applyCanvasStyle(ctx, item);
    if (item.type === "rect") {
      if (item.fill && item.fill !== "none") ctx.fillRect(item.x, item.y, item.width, item.height);
      if (item.stroke && item.stroke !== "none") ctx.strokeRect(item.x, item.y, item.width, item.height);
    } else if (item.type === "line") {
      ctx.beginPath();
      ctx.moveTo(item.x1, item.y1);
      ctx.lineTo(item.x2, item.y2);
      ctx.stroke();
    } else if (item.type === "circle") {
      ctx.beginPath();
      ctx.arc(item.cx, item.cy, item.radius, 0, 2 * Math.PI);
      if (item.fill && item.fill !== "none") ctx.fill();
      if (item.stroke && item.stroke !== "none") ctx.stroke();
    } else if (item.type === "polyline" || item.type === "polygon") {
      if (!item.points || item.points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(item.points[0][0], item.points[0][1]);
      for (var i = 1; i < item.points.length; i++) ctx.lineTo(item.points[i][0], item.points[i][1]);
      if (item.type === "polygon") ctx.closePath();
      if (item.fill && item.fill !== "none") ctx.fill();
      if (item.stroke && item.stroke !== "none") ctx.stroke();
    } else if (item.type === "text") {
      ctx.fillStyle = item.fill || "#333333";
      ctx.textAlign = item.anchor === "end" ? "right" : item.anchor === "middle" ? "center" : "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = (item.fontWeight ? item.fontWeight + " " : "") + item.fontSize + "px " + FONT_FAMILY;
      ctx.save();
      ctx.translate(item.x, item.y);
      if (item.rotate) ctx.rotate(item.rotate * Math.PI / 180);
      ctx.fillText(item.text, 0, 0);
      ctx.restore();
    }
  }

  function renderCanvas(canvas, scene) {
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    canvas.width = scene.width * dpr;
    canvas.height = scene.height * dpr;
    canvas.style.width = scene.width + "px";
    canvas.style.height = scene.height + "px";
    ctx.scale(dpr, dpr);
    scene.items.forEach(function(item) {
      if (item.clip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(scene.margin.left, scene.margin.top, scene.plotWidth, scene.plotHeight);
        ctx.clip();
        renderCanvasItem(ctx, item);
        ctx.restore();
      } else {
        renderCanvasItem(ctx, item);
      }
    });
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function number(value) {
    return Number(value.toFixed(3));
  }

  function svgStyle(item) {
    var attrs = [];
    if (item.fill != null) attrs.push('fill="' + escapeXml(item.fill) + '"');
    else if (item.type !== "text") attrs.push('fill="none"');
    if (item.stroke != null) attrs.push('stroke="' + escapeXml(item.stroke) + '"');
    if (item.strokeWidth != null) attrs.push('stroke-width="' + number(item.strokeWidth) + '"');
    if (item.opacity != null) attrs.push('opacity="' + item.opacity + '"');
    if (item.dash && item.dash.length) attrs.push('stroke-dasharray="' + item.dash.map(number).join(" ") + '"');
    if (item.clip) attrs.push('clip-path="url(#plot-clip)"');
    if (item.type === "polyline" || item.type === "polygon" || item.type === "line") {
      attrs.push('stroke-linejoin="round" stroke-linecap="round"');
    }
    return attrs.join(" ");
  }

  function svgItem(item) {
    var style = svgStyle(item);
    if (item.type === "rect") {
      return '<rect x="' + number(item.x) + '" y="' + number(item.y) + '" width="' +
        number(item.width) + '" height="' + number(item.height) + '" ' + style + '/>';
    }
    if (item.type === "line") {
      return '<line x1="' + number(item.x1) + '" y1="' + number(item.y1) + '" x2="' +
        number(item.x2) + '" y2="' + number(item.y2) + '" ' + style + '/>';
    }
    if (item.type === "circle") {
      return '<circle cx="' + number(item.cx) + '" cy="' + number(item.cy) + '" r="' +
        number(item.radius) + '" ' + style + '/>';
    }
    if (item.type === "polyline" || item.type === "polygon") {
      var points = item.points.map(function(point) {
        return number(point[0]) + "," + number(point[1]);
      }).join(" ");
      return '<' + item.type + ' points="' + points + '" ' + style + '/>';
    }
    if (item.type === "text") {
      var transform = item.rotate ? ' transform="rotate(' + item.rotate + " " + number(item.x) + " " + number(item.y) + ')"' : "";
      return '<text x="' + number(item.x) + '" y="' + number(item.y) + '" text-anchor="' +
        (item.anchor || "start") + '" font-family="' + escapeXml(FONT_FAMILY) + '" font-size="' +
        number(item.fontSize) + '"' + (item.fontWeight ? ' font-weight="' + item.fontWeight + '"' : "") +
        ' fill="' + escapeXml(item.fill || "#333333") + '"' + transform + '>' + escapeXml(item.text) + '</text>';
    }
    return "";
  }

  function sceneToSvg(scene) {
    var clip = '<defs><clipPath id="plot-clip"><rect x="' + number(scene.margin.left) +
      '" y="' + number(scene.margin.top) + '" width="' + number(scene.plotWidth) +
      '" height="' + number(scene.plotHeight) + '"/></clipPath></defs>';
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + scene.width + '" height="' + scene.height +
      '" viewBox="0 0 ' + scene.width + " " + scene.height +
      '" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">' +
      '<title>' + escapeXml(scene.title) + '</title>' + clip + scene.items.map(svgItem).join("") + '</svg>';
  }

  function canvasSize(canvas) {
    var rectangle = canvas.parentElement.getBoundingClientRect();
    return { width: rectangle.width > 100 ? rectangle.width : 900, height: 600 };
  }

  function exportSize(options) {
    options = options || {};
    return {
      width: options.width || EXPORT_WIDTH,
      height: options.height || EXPORT_HEIGHT
    };
  }

  return {
    drawVtChart: function(canvas, datasets, colors) {
      var size = canvasSize(canvas);
      renderCanvas(canvas, createVtScene(datasets, colors, size.width, size.height));
    },

    drawEtNtChart: function(canvas, datasets, colors) {
      var size = canvasSize(canvas);
      renderCanvas(canvas, createEtNtScene(datasets, colors, size.width, size.height));
    },

    exportVtSvg: function(datasets, colors, options) {
      var size = exportSize(options);
      return sceneToSvg(createVtScene(datasets, colors, size.width, size.height));
    },

    exportEtNtSvg: function(datasets, colors, options) {
      var size = exportSize(options);
      return sceneToSvg(createEtNtScene(datasets, colors, size.width, size.height));
    }
  };
})();
