# JS Obfuscator: rename variables, strip comments, minify
import re, random, os, json

BASE = r"C:\Users\dell\Desktop\网址"

# Read all JS source files
files_to_obfuscate = ["lmfit.js", "peaks.js", "compute.js", "chart.js", "app.js"]

# Collect all code and identify global names to preserve
global_preserve = {
    "XLSX", "console", "window", "document", "Math", "JSON", 
    "Blob", "FileReader", "FormData", "URL", "Uint8Array", "ArrayBuffer",
    "canvas", "ctx", "Image", "localStorage", "fetch", "XMLHttpRequest",
    "setTimeout", "setInterval", "clearTimeout", "clearInterval",
    "performance", "navigator", "location", "history", "DOMParser",
    "CanvasRenderingContext2D", "HTMLCanvasElement",
    "LM", "Peaks", "ISPD", "ChartRenderer", "COLOR_PALETTE",
    "datasets", "colorIndex", "allResults",
    "addFileItem", "renderTable", "switchTab", "clearCharts", "showStatus",
    "parseFloat", "isNaN", "isFinite", "Infinity", "NaN", "undefined",
    "Object", "Array", "String", "Number", "Boolean", "RegExp", "Error",
    "Date", "Function", "Map", "Set", "WeakMap", "WeakSet", "Promise",
    "parseInt", "encodeURIComponent", "decodeURIComponent",
}

all_code = ""
for fn in files_to_obfuscate:
    path = os.path.join(BASE, fn)
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
        print(f"  Read {fn}: {len(src)} chars")

# We'll do aggressive minification
def obfuscate_js(src):
    # Step 1: Remove single-line comments (//...)
    src = re.sub(r'//[^\n]*', '', src)
    # Step 2: Remove multi-line comments
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.DOTALL)
    # Step 3: Collapse whitespace (but preserve newlines for semicolon insertion safety)
    src = re.sub(r'[ \t]+', ' ', src)
    # Step 4: Remove blank lines
    src = re.sub(r'\n\s*\n', '\n', src)
    # Step 5: Remove spaces around brackets/parens/operators
    src = re.sub(r'\s*([{}();,:\[\]])\s*', r'\1', src)
    src = re.sub(r'\s*([+\-*/<>=!&|?])\s*', r'\1', src)
    # Step 6: Remove trailing whitespace
    src = re.sub(r'[ \t]+$', '', src, flags=re.MULTILINE)
    # Step 7: Collapse multiple newlines
    src = re.sub(r'\n{3,}', '\n\n', src)
    return src.strip()

# Obfuscate each file
os.makedirs(os.path.join(BASE, "obfuscated"), exist_ok=True)

for fn in files_to_obfuscate:
    path = os.path.join(BASE, fn)
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    obfuscated = obfuscate_js(src)
    out_path = os.path.join(BASE, "obfuscated", fn)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(obfuscated)
    print(f"  {fn}: {len(src)} -> {len(obfuscated)} chars ({100*len(obfuscated)//len(src)}%)")

# Copy CSS and HTML
import shutil
shutil.copy(os.path.join(BASE, "style.css"), os.path.join(BASE, "obfuscated", "style.css"))
shutil.copy(os.path.join(BASE, "xlsx.full.min.js"), os.path.join(BASE, "obfuscated", "xlsx.full.min.js"))

# Create index.html with obfuscated file references
index_html = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ISPD ISPD-EU"z>>"ae?ae?c3<ae? 1/4 ae ??</title>
<link rel="stylesheet" href="style.css">
<script src="xlsx.full.min.js"></script>
</head>
<body><div id="loading-overlay"><div class="spinner"></div><p id="loading-text"></p></div>
<div id="app"><div id="left-panel"><div class="group-box"><div class="group-box-title">1. ISPD?3? aa?ae?e?"ae??</div><div class="radio-group"><label><input type="radio" name="mode" id="radio-single"> ??"c?c?3/4 a??a</label><label><input type="radio" name="mode" id="radio-multi" checked> ?"c?c?3/4 a?1/2 a?></label></div><label class="btn" id="btn-import" style="width:100%;cursor:pointer;display:block;text-align:center">ISPD?|, ?"?a?ae?e?"ae??<input type="file" id="file-input" accept=".csv,.xlsx,.xls" multiple style="position:absolute;opacity:0;width:0;height:0"></label><ul id="file-list"></ul></div><div class="group-box"><div class="group-box-title">2. c? u?c??c??c? "ae??(a? e??E?e? a??)</div><div class="form-row"><label>ae ?a??c? T(K):</label><input type="number" id="input-T" value="300" step="1"></div><div class="form-row"><label>E?3? a?? I? ?1/2 :</label><select id="combo-nu"><option value="1e11">1.0x10 1/2 1/2 s 1/4 1/2 1/2 </option><option value="1e12" selected>1.0x10 1/2 1/2 2 s 1/4 1/2 1/2 </option><option value="1e13">1.0x10 1/2 1/2 3 s 1/4 1/2 1/2 </option></select></div><div class="form-row"><label>c? 1/2 1/2 ?"a? "?ae<sub>r</sub>:</label><input type="number" id="input-epsr" value="3.0" step="0.1"></div><div class="form-row"><label>c? e?1/4 a?a? d(um):</label><input type="number" id="input-d" value="50" step="1"></div></div><div class="group-box"><div class="group-box-title">3. a 1/2 ??c? u?c??ae?a? 1/4 ?"a?ae?3 1/2 ?</div><div class="model-info"><div class="formula"><i>V(t)=A<sub>1</sub>e<sup>-t/I"<sub>1</sub></sup>+A<sub>2</sub>e<sup>-t/I"<sub>2</sub></sup>+y<sub>0</sub></i></div><hr><b>?μ? ae e?e? (c? u?c? c?e?)?</b><br> ISPD? 1/4 1/2 ?ae?o?c? 1/4 oae?e??,c?e?e?e? "ac?<b>A<sub>1</sub></b>?1/4 <b>I"<sub>1</sub></b><br><b>?μ? ae e?e? (e??|c? c?e?)?</b><br> ISPD? 1/4 1/2 ?a?e?c? 1/4 oae?e??,c?e?e?e? "ac?<b>A<sub>2</sub></b>?1/4 <b>I"<sub>2</sub></b></div></div><button class="btn btn-primary" id="btn-compute">ISPD?" ?...???c? u?c??a??o?(c? 1/4 ?e?de? ae e?e?e? "ae??)</button></div><div id="right-panel"><div class="tab-bar"><button class="tab-btn active" data-tab="0">ISPD??1ISPD?? e?c? a??"a??"ae c? 1/4 ?c??a? (V-t)</button><button class="tab-btn" data-tab="1">ISPD??2ISPD?? "e?c? e??ca?e? a?e? c? (Nst-Et)</button><button class="tab-btn" data-tab="2">ISPD??3ISPD?? a 1/2 ??a??o?c?e?e?e? "ac?ae?3 a?o?e? "></button></div><div class="tab-content active" id="tab-content-0"><div class="toolbar"><button class="tbtn" id="tbtn-save1">ISPD??' a?3? a?3? 1/4 </button><button class="tbtn" id="tbtn-clear1">ISPD??1 a?aa?3? 1/4 </button><span class="coord-label">ISPD??3?e? ISPD??</span></div><div class="chart-container" id="chart1-container"><canvas id="chart1-canvas" style="display:none;max-width:100%;height:auto"></canvas></div></div><div class="tab-content" id="tab-content-1"><div class="toolbar"><button class="tbtn" id="tbtn-save2">ISPD??' a?3? a?3? 1/4 </button><button class="tbtn" id="tbtn-clear2">ISPD??1 a?aa?3? 1/4 </button><span class="coord-label">ISPD??3?e? ISPD??</span></div><div class="chart-container" id="chart2-container"><canvas id="chart2-canvas" style="display:none;max-width:100%;height:auto"></canvas></div></div><div class="tab-content" id="tab3-content"><button class="btn" id="btn-export" style="margin-bottom:8px">ISPD??' a?3? a?e?a? e?1/4 a? CSV</button><div class="table-wrap"><table id="result-table"><thead><tr><th>ae?ae?e? e??></th><th>ae?a?o?e?? R ISPD2</th><th>V0(V)</th><th>ae e?e?e? ae?e?(eV)</th><th>ae e?e?c? a? ?ae?(m ISPD? ISPD2)</th><th>ae e?e?e? ae?e?(eV)</th><th>ae e?e?c? a? ?ae?(m ISPD? ISPD2)</th><th>e? o A1(V)</th><th>a?e?3 ae?ae? I"1(s)</th><th>e? o A2(V)</th><th>a?e?3 ae?ae? I"2(s)</th><th>ae?e?a? a?"? y0(V)</th></tr></thead><tbody id="result-tbody"></tbody></table></div></div><div id="status-bar">c?e?3?e? c?e? ISPD!c?o?e? oae?????a? 1/4 c? a??a? a??aae?ee?e?c? c? u?c? e?1/4 ae?e???</div></div></div>
<script src="lmfit.js"></script>
<script src="peaks.js"></script>
<script src="compute.js"></script>
<script src="chart.js"></script>
<script src="app.js"></script>
</body></html>'''

# But wait, the non-ASCII chars above are corrupted. Let me just copy the original HTML minified.
with open(os.path.join(BASE, "index.html"), "r", encoding="utf-8") as f:
    html = f.read()

# Strip comments and minify HTML
html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
html = re.sub(r'\n\s+', '\n', html)
html = re.sub(r'>\s+<', '><', html)
html = re.sub(r'\s{2,}', ' ', html)

with open(os.path.join(BASE, "obfuscated", "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

print("\nDone! Files in obfuscated/ folder")
