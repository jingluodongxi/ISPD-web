// ISPD Web - Pure Client-Side Application Logic
// No server, no CDN, no fetch() calls - everything runs in browser

var COLOR_PALETTE = ['#005FB8','#D95319','#EDB120','#7E2F8E','#77AC30','#4DBEEE','#A2142F','#000000'];
var datasets = {};
var colorIndex = 0;
var allResults = [];

(function init() {
  document.getElementById('loading-overlay').classList.add('hidden');
  showStatus('系统就绪：采用双指数拟合与面陷阱密度解析模型。请导入数据并点击运行。');
})();

// ==============================
// 1. File Upload (using SheetJS bundled locally)
// ==============================
document.getElementById('file-input').addEventListener('change', function(e) {
  var files = Array.from(e.target.files);
  if (files.length === 0) return;

  var singleMode = document.getElementById('radio-single').checked;
  if (singleMode) {
    datasets = {}; colorIndex = 0;
    document.getElementById('file-list').innerHTML = '';
  }

  files.forEach(function(file) {
    if (datasets[file.name]) return;
    var reader = new FileReader();
    reader.onload = function(evt) {
      try {
        var data = new Uint8Array(evt.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        var sheetName = workbook.SheetNames[0];
        var sheet = workbook.Sheets[sheetName];
        var jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

        // Filter out empty rows
        var rows = jsonData.filter(function(r) { return r && r.length >= 2; });

        // Auto-detect header row
        var startRow = 0;
        if (rows.length > 0 && typeof rows[0][0] === 'string' && isNaN(parseFloat(rows[0][0]))) {
          startRow = 1;
        }

        var t = [], v = [];
        for (var k = startRow; k < rows.length; k++) {
          var tv = parseFloat(rows[k][0]);
          var vv = parseFloat(rows[k][1]);
          if (!isNaN(tv) && isFinite(tv) && !isNaN(vv) && isFinite(vv)) {
            t.push(tv);
            v.push(vv);
          }
        }

        if (t.length < 3) {
          showStatus(file.name + ' 解析失败: 有效数据点不足（需要 >= 3）', 'error');
          return;
        }

        var color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
        colorIndex++;
        datasets[file.name] = { t: t, v: v, color: color };
        addFileItem(file.name, color);
        showStatus('已挂载: ' + file.name + ' (' + t.length + ' 个数据点)');
      } catch (err) {
        showStatus(file.name + ' 解析失败: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  });

  e.target.value = '';
});

// ==============================
// 2. File List UI
// ==============================
function addFileItem(name, color) {
  var li = document.createElement('li');
  li.innerHTML = '<span class="dot" style="background:' + color + '"></span>' +
    '<input type="checkbox" checked>' +
    '<span style="flex:1">' + name + '</span>';
  document.getElementById('file-list').appendChild(li);
}

// ==============================
// 3. Mode Switch (Single / Multi)
// ==============================
document.querySelectorAll('input[name="mode"]').forEach(function(r) {
  r.addEventListener('change', function() {
    if (document.getElementById('radio-single').checked) {
      document.getElementById('file-list').innerHTML = '';
      datasets = {}; colorIndex = 0;
    }
  });
});

// ==============================
// 4. Compute + Draw Charts
// ==============================
document.getElementById('btn-compute').addEventListener('click', function() {
  var items = document.querySelectorAll('#file-list li');
  var checkedNames = [];
  items.forEach(function(li) {
    var cb = li.querySelector('input[type="checkbox"]');
    var span = li.querySelector('span:last-child');
    if (cb && cb.checked && span) checkedNames.push(span.textContent);
  });

  if (checkedNames.length === 0) {
    showStatus('请在列表中至少勾选一个数据文件！', 'warn');
    return;
  }

  try {
    var T = parseFloat(document.getElementById('input-T').value) || 300;
    var nu = parseFloat(document.getElementById('combo-nu').value) || 1e12;
    var eps_r = parseFloat(document.getElementById('input-epsr').value) || 3.0;
    var d_um = parseFloat(document.getElementById('input-d').value) || 50;

    showStatus('正在运行双指数解析与陷阱参数识别计算...');
    allResults = [];
    var vtSeries = [], etntSeries = [], colors = [];

    checkedNames.forEach(function(name) {
      var ds = datasets[name];
      if (!ds) return;

      var result = ISPD.compute(ds.t, ds.v, T, nu, eps_r, d_um);
      result.filename = name;
      result.color = ds.color;
      allResults.push(result);
      colors.push(ds.color);

      vtSeries.push({
        tLog: result.tLog,
        vRaw: result.vRaw,
        tLogDense: result.tLogDense,
        vDense: result.vDense,
        label: name + ' (R²=' + result.r2.toFixed(4) + ')'
      });

      etntSeries.push({
        E_t: result.E_t,
        N_t: result.N_t,
        shallow_E: result.shallow_E,
        shallow_N: result.shallow_N,
        deep_E: result.deep_E,
        deep_N: result.deep_N,
        label: name
      });
    });

    // Draw V-t chart
    var canvas1 = document.getElementById('chart1-canvas');
    canvas1.style.display = 'block';
    ChartRenderer.drawVtChart(canvas1, vtSeries, colors);

    // Draw Et-Nt chart
    var canvas2 = document.getElementById('chart2-canvas');
    canvas2.style.display = 'block';
    ChartRenderer.drawEtNtChart(canvas2, etntSeries, colors);

    // Render table
    renderTable();
    switchTab(1);
    showStatus('解析成功！已从 ' + checkedNames.length + ' 组曲线中提取出完整的多维物理特征库。');

  } catch (err) {
    showStatus('运行异常: ' + err.message, 'error');
    console.error(err);
  }
});

// ==============================
// 5. Table Rendering
// ==============================
function renderTable() {
  var tbody = document.getElementById('result-tbody');
  tbody.innerHTML = '';
  allResults.forEach(function(r) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + r.filename + '</td>' +
      '<td>' + r.r2.toFixed(4) + '</td>' +
      '<td>' + r.v0.toFixed(2) + '</td>' +
      '<td>' + (r.shallow_E != null ? r.shallow_E.toFixed(4) : '-') + '</td>' +
      '<td>' + (r.shallow_N != null ? r.shallow_N.toExponential(2) : '-') + '</td>' +
      '<td>' + (r.deep_E != null ? r.deep_E.toFixed(4) : '-') + '</td>' +
      '<td>' + (r.deep_N != null ? r.deep_N.toExponential(2) : '-') + '</td>' +
      '<td>' + r.A1.toFixed(2) + '</td>' +
      '<td>' + r.tau1.toFixed(2) + '</td>' +
      '<td>' + r.A2.toFixed(2) + '</td>' +
      '<td>' + r.tau2.toFixed(2) + '</td>' +
      '<td>' + r.y0.toFixed(2) + '</td>';
    tbody.appendChild(tr);
  });
}

// ==============================
// 6. Tabs
// ==============================
function switchTab(idx) {
  document.querySelectorAll('.tab-btn').forEach(function(b, i) {
    b.classList.toggle('active', i === idx);
  });
  document.getElementById('tab-content-0').classList.toggle('active', idx === 0);
  document.getElementById('tab-content-1').classList.toggle('active', idx === 1);
  document.getElementById('tab3-content').classList.toggle('active', idx === 2);
}

document.querySelectorAll('.tab-btn').forEach(function(b) {
  b.addEventListener('click', function() {
    switchTab(parseInt(this.dataset.tab));
  });
});

// ==============================
// 7. Export CSV
// ==============================
document.getElementById('btn-export').addEventListener('click', function() {
  if (allResults.length === 0) {
    showStatus('表格中无数据可导出！', 'warn');
    return;
  }
  var csv = '数据标识,拟合优度 R²,V0 (V),浅陷阱峰深度(eV),浅陷阱面密度(m⁻²),深陷阱峰深度(eV),深陷阱面密度(m⁻²),幅值 A1 (V),弛豫时间 τ1 (s),幅值 A2 (V),弛豫时间 τ2 (s),残余电位 y0 (V)\n';
  allResults.forEach(function(r) {
    csv += [
      r.filename, r.r2.toFixed(4), r.v0.toFixed(2),
      r.shallow_E != null ? r.shallow_E.toFixed(4) : '-',
      r.shallow_N != null ? r.shallow_N.toExponential(2) : '-',
      r.deep_E != null ? r.deep_E.toFixed(4) : '-',
      r.deep_N != null ? r.deep_N.toExponential(2) : '-',
      r.A1.toFixed(2), r.tau1.toFixed(2),
      r.A2.toFixed(2), r.tau2.toFixed(2),
      r.y0.toFixed(2)
    ].join(',') + '\n';
  });
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ISPD_Physics_Parameters.csv';
  a.click();
});

// ==============================
// 8. Chart Export (Save as PNG)
// ==============================
document.getElementById('tbtn-save1').addEventListener('click', function() {
  var canvas = document.getElementById('chart1-canvas');
  var a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'ISPD_Vt_Chart.png';
  a.click();
});

document.getElementById('tbtn-save2').addEventListener('click', function() {
  var canvas = document.getElementById('chart2-canvas');
  var a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'ISPD_EtNt_Chart.png';
  a.click();
});

// ==============================
// 9. Clear Charts
// ==============================
function clearCharts() {
  var c1 = document.getElementById('chart1-canvas');
  var c2 = document.getElementById('chart2-canvas');
  var ctx1 = c1.getContext('2d');
  var ctx2 = c2.getContext('2d');
  ctx1.clearRect(0, 0, c1.width, c1.height);
  ctx2.clearRect(0, 0, c2.width, c2.height);
  c1.style.display = 'none';
  c2.style.display = 'none';
  document.getElementById('result-tbody').innerHTML = '';
  allResults = [];
  showStatus('图表与特征数据已清空。');
}

document.getElementById('tbtn-clear1').addEventListener('click', clearCharts);
document.getElementById('tbtn-clear2').addEventListener('click', clearCharts);

// ==============================
// 10. Status Bar
// ==============================
function showStatus(msg, type) {
  var el = document.getElementById('status-bar');
  el.textContent = msg;
  el.style.color = type === 'error' ? '#D95319' : type === 'warn' ? '#EDB120' : '#475569';
}
