var COLOR_PALETTE = [
  "#005FB8", "#D95319", "#EDB120", "#7E2F8E",
  "#77AC30", "#4DBEEE", "#A2142F", "#000000"
];
var datasets = {};
var colorIndex = 0;
var allResults = [];

function addFileItem(filename, color) {
  var item = document.createElement("li");
  var dot = document.createElement("span");
  var checkbox = document.createElement("input");
  var name = document.createElement("span");

  dot.className = "dot";
  dot.style.background = color;
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.dataset.filename = filename;
  name.style.flex = "1";
  name.textContent = filename;

  item.appendChild(dot);
  item.appendChild(checkbox);
  item.appendChild(name);
  document.getElementById("file-list").appendChild(item);
}

function peakNature(isExtrapolated) {
  return isExtrapolated ? "外推峰（首个测点前）" : "测量范围内";
}

function renderTable() {
  var tbody = document.getElementById("result-tbody");
  tbody.innerHTML = "";

  allResults.forEach(function(result) {
    var values = [
      result.filename,
      result.tFirst.toFixed(2),
      result.r2.toFixed(4),
      result.v0.toFixed(2),
      result.shallow_E != null ? result.shallow_E.toFixed(4) : "-",
      result.shallow_N != null ? result.shallow_N.toExponential(2) : "-",
      peakNature(result.shallow_extrapolated),
      result.deep_E != null ? result.deep_E.toFixed(4) : "-",
      result.deep_N != null ? result.deep_N.toExponential(2) : "-",
      peakNature(result.deep_extrapolated),
      result.A1.toFixed(2),
      result.tau1.toFixed(2),
      result.A2.toFixed(2),
      result.tau2.toFixed(2),
      result.y0.toFixed(2)
    ];
    var row = document.createElement("tr");
    values.forEach(function(value) {
      var cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
}

function switchTab(index) {
  document.querySelectorAll(".tab-btn").forEach(function(button, buttonIndex) {
    button.classList.toggle("active", buttonIndex === index);
  });
  document.getElementById("tab-content-0").classList.toggle("active", index === 0);
  document.getElementById("tab-content-1").classList.toggle("active", index === 1);
  document.getElementById("tab3-content").classList.toggle("active", index === 2);
}

function clearCharts() {
  var chart1 = document.getElementById("chart1-canvas");
  var chart2 = document.getElementById("chart2-canvas");
  chart1.getContext("2d").clearRect(0, 0, chart1.width, chart1.height);
  chart2.getContext("2d").clearRect(0, 0, chart2.width, chart2.height);
  chart1.style.display = "none";
  chart2.style.display = "none";
  document.getElementById("result-tbody").innerHTML = "";
  allResults = [];
  showStatus("图表与特征数据已清空。");
}

function showStatus(message, type) {
  var status = document.getElementById("status-bar");
  status.textContent = message;
  status.style.color = type === "error" ? "#D95319" :
    type === "warn" ? "#B7791F" : "#475569";
}

function validateParsedTimes(times) {
  for (var i = 0; i < times.length; i++) {
    if (times[i] <= 0) {
      throw new Error("时间必须全部大于 0 s，第 " + (i + 1) + " 个有效时间为 " + times[i] + " s");
    }
    if (i > 0 && times[i] <= times[i - 1]) {
      throw new Error(
        "时间必须严格递增，不允许重复或倒序；请检查 " +
        times[i - 1] + " s 与 " + times[i] + " s"
      );
    }
  }
}

function parseWorkbook(arrayBuffer) {
  var workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  var rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: null })
    .filter(function(row) { return row && row.length >= 2; });
  var startRow = 0;

  if (rows.length > 0 && typeof rows[0][0] === "string" && isNaN(parseFloat(rows[0][0]))) {
    startRow = 1;
  }

  var times = [];
  var voltages = [];
  for (var i = startRow; i < rows.length; i++) {
    var time = parseFloat(rows[i][0]);
    var voltage = parseFloat(rows[i][1]);
    if (isFinite(time) && isFinite(voltage)) {
      times.push(time);
      voltages.push(voltage);
    }
  }

  if (times.length < 3) {
    throw new Error("有效数据点不足（至少需要 3 个）");
  }
  validateParsedTimes(times);
  return { t: times, v: voltages };
}

document.getElementById("loading-overlay").classList.add("hidden");
showStatus("系统就绪：支持不同起始时间，并区分实测范围与首点前外推。");

document.getElementById("file-input").addEventListener("change", function(event) {
  var files = Array.from(event.target.files);
  if (files.length === 0) return;

  if (document.getElementById("radio-single").checked) {
    datasets = {};
    colorIndex = 0;
    document.getElementById("file-list").innerHTML = "";
  }

  files.forEach(function(file) {
    if (datasets[file.name]) return;
    var reader = new FileReader();
    reader.onload = function(loadEvent) {
      try {
        var parsed = parseWorkbook(loadEvent.target.result);
        var color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
        colorIndex++;
        datasets[file.name] = { t: parsed.t, v: parsed.v, color: color };
        addFileItem(file.name, color);
        showStatus(
          "已挂载 " + file.name + "（" + parsed.t.length +
          " 个数据点，首个测点 " + parsed.t[0] + " s）"
        );
      } catch (error) {
        showStatus(file.name + " 解析失败：" + error.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  });
  event.target.value = "";
});

document.querySelectorAll('input[name="mode"]').forEach(function(radio) {
  radio.addEventListener("change", function() {
    if (document.getElementById("radio-single").checked) {
      document.getElementById("file-list").innerHTML = "";
      datasets = {};
      colorIndex = 0;
    }
  });
});

document.getElementById("btn-compute").addEventListener("click", function() {
  var selectedFiles = [];
  document.querySelectorAll("#file-list input[type='checkbox']").forEach(function(checkbox) {
    if (checkbox.checked) selectedFiles.push(checkbox.dataset.filename);
  });

  if (selectedFiles.length === 0) {
    showStatus("请在列表中至少勾选一个数据文件。", "warn");
    return;
  }

  try {
    var temperature = parseFloat(document.getElementById("input-T").value) || 300;
    var frequency = parseFloat(document.getElementById("combo-nu").value) || 1e12;
    var epsilonR = parseFloat(document.getElementById("input-epsr").value) || 3;
    var thickness = parseFloat(document.getElementById("input-d").value) || 50;
    var vtDatasets = [];
    var trapDatasets = [];
    var colors = [];

    showStatus("正在运行双指数拟合与陷阱参数计算……");
    allResults = [];

    selectedFiles.forEach(function(filename) {
      var source = datasets[filename];
      if (!source) return;
      var result = ISPD.compute(
        source.t, source.v, temperature, frequency, epsilonR, thickness
      );
      result.filename = filename;
      result.color = source.color;
      allResults.push(result);
      colors.push(source.color);

      vtDatasets.push({
        tLog: result.tLog,
        vRaw: result.vRaw,
        tLogDense: result.tLogDense,
        vDense: result.vDense,
        label: filename + " (R²=" + result.r2.toFixed(4) + ")"
      });
      trapDatasets.push({
        EMeasured: result.EMeasured,
        NMeasured: result.NMeasured,
        EExtrapolated: result.EExtrapolated,
        NExtrapolated: result.NExtrapolated,
        shallow_E: result.shallow_E,
        shallow_N: result.shallow_N,
        deep_E: result.deep_E,
        deep_N: result.deep_N,
        label: filename
      });
    });

    var chart1 = document.getElementById("chart1-canvas");
    chart1.style.display = "block";
    ChartRenderer.drawVtChart(chart1, vtDatasets, colors);

    var chart2 = document.getElementById("chart2-canvas");
    chart2.style.display = "block";
    ChartRenderer.drawEtNtChart(chart2, trapDatasets, colors);

    renderTable();
    switchTab(1);
    showStatus(
      "分析成功：已处理 " + selectedFiles.length +
      " 组曲线。虚线仅表示首个测点之前的模型外推。"
    );
  } catch (error) {
    showStatus("运行异常：" + error.message, "error");
    console.error(error);
  }
});

document.querySelectorAll(".tab-btn").forEach(function(button) {
  button.addEventListener("click", function() {
    switchTab(parseInt(this.dataset.tab, 10));
  });
});

function csvCell(value) {
  var text = String(value == null ? "" : value);
  return '"' + text.replace(/"/g, '""') + '"';
}

document.getElementById("btn-export").addEventListener("click", function() {
  if (allResults.length === 0) {
    showStatus("表格中没有可导出的数据。", "warn");
    return;
  }

  var rows = [[
    "数据标识", "首个测量时间 (s)", "拟合优度 R²", "V0 (V)",
    "浅陷阱峰深度 (eV)", "浅陷阱面密度 (m⁻²)", "浅峰性质",
    "深陷阱峰深度 (eV)", "深陷阱面密度 (m⁻²)", "深峰性质",
    "幅值 A1 (V)", "弛豫时间 τ1 (s)", "幅值 A2 (V)",
    "弛豫时间 τ2 (s)", "残余电位 y0 (V)"
  ]];

  allResults.forEach(function(result) {
    rows.push([
      result.filename,
      result.tFirst.toFixed(2),
      result.r2.toFixed(4),
      result.v0.toFixed(2),
      result.shallow_E != null ? result.shallow_E.toFixed(4) : "-",
      result.shallow_N != null ? result.shallow_N.toExponential(2) : "-",
      peakNature(result.shallow_extrapolated),
      result.deep_E != null ? result.deep_E.toFixed(4) : "-",
      result.deep_N != null ? result.deep_N.toExponential(2) : "-",
      peakNature(result.deep_extrapolated),
      result.A1.toFixed(2),
      result.tau1.toFixed(2),
      result.A2.toFixed(2),
      result.tau2.toFixed(2),
      result.y0.toFixed(2)
    ]);
  });

  var csv = rows.map(function(row) {
    return row.map(csvCell).join(",");
  }).join("\r\n");
  var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);
  link.href = url;
  link.download = "ISPD_Physics_Parameters.csv";
  link.click();
  URL.revokeObjectURL(url);
});

document.getElementById("tbtn-save1").addEventListener("click", function() {
  var canvas = document.getElementById("chart1-canvas");
  var link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "ISPD_Vt_Chart.png";
  link.click();
});

document.getElementById("tbtn-save2").addEventListener("click", function() {
  var canvas = document.getElementById("chart2-canvas");
  var link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "ISPD_EtNt_Chart.png";
  link.click();
});

document.getElementById("tbtn-clear1").addEventListener("click", clearCharts);
document.getElementById("tbtn-clear2").addEventListener("click", clearCharts);
